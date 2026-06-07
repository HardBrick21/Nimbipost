import { createHmac } from 'node:crypto';
import { X_PATHS } from './endpoints';

export interface LoginCredentials {
  username?: string;
  password: string;
  email?: string;
  phone?: string;
  verificationCode?: string;
  mfaSecret?: string;
}

export interface LoginRequestClient {
  request(
    url: string,
    options?: {
      method?: string;
      params?: Record<string, string>;
      json?: unknown;
      skipErrorChecking?: boolean;
    },
  ): Promise<Record<string, unknown>>;
}

export interface XLoginTaskHandlerOptions {
  requestClient: LoginRequestClient;
  loginLocation?: () => 'splash_screen' | 'manual_link';
  promptVerification?: (message: string) => Promise<string> | string;
}

type TaskExecutor = (
  flowToken: string,
  subtaskId: string,
  parameter?: string,
) => Promise<Record<string, unknown>>;

interface TaskMapping {
  taskExecutor?: TaskExecutor;
  taskParameter?: string;
  taskOutput?: string;
}

const SUBTASK_VERSIONS = {
  action_list: 2,
  alert_dialog: 1,
  app_download_cta: 1,
  check_logged_in_account: 1,
  choice_selection: 3,
  contacts_live_sync_permission_prompt: 0,
  cta: 7,
  email_verification: 2,
  end_flow: 1,
  enter_date: 1,
  enter_email: 2,
  enter_password: 5,
  enter_phone: 2,
  enter_recaptcha: 1,
  enter_text: 5,
  enter_username: 2,
  generic_urt: 3,
  in_app_notification: 1,
  interest_picker: 3,
  js_instrumentation: 1,
  menu_dialog: 1,
  notifications_permission_prompt: 2,
  open_account: 2,
  open_home_timeline: 1,
  open_link: 1,
  phone_verification: 4,
  privacy_options: 1,
  security_key: 3,
  select_avatar: 4,
  select_banner: 2,
  settings_list: 7,
  show_code: 1,
  sign_up: 2,
  sign_up_review: 4,
  tweet_selection_urt: 1,
  update_users: 1,
  upload_media: 1,
  user_recommendations_list: 4,
  user_recommendations_urt: 1,
  wait_spinner: 3,
  web_modal: 1,
};

export class XLoginTaskHandler {
  private requestClient: LoginRequestClient;
  private loginLocation: () => 'splash_screen' | 'manual_link';
  private promptVerification?: (message: string) => Promise<string> | string;

  constructor(options: XLoginTaskHandlerOptions) {
    this.requestClient = options.requestClient;
    this.loginLocation = options.loginLocation ?? randomLoginLocation;
    this.promptVerification = options.promptVerification;
  }

  async login(credentials: LoginCredentials): Promise<void> {
    const username = credentials.username ?? credentials.email;
    if (!username) {
      throw new Error('username or email is required.');
    }

    const taskFlowMapper = this.createTaskMapper(
      username,
      credentials.password,
      undefined,
    );
    let response = await this.getFlowToken();
    await this.getJavascriptInstrumentationSubtask();

    while (true) {
      const subtasks = getSubtaskIds(response);
      const flowToken = String(response.flow_token ?? '');
      const taskId = Object.keys(taskFlowMapper).find((id) =>
        subtasks.includes(id),
      );

      if (!taskId) {
        throw new Error(
          `Couldn't find the following Task Ids:\n${subtasks.join(', ')}`,
        );
      }

      const task = taskFlowMapper[taskId];

      if (taskId === 'LoginSuccessSubtask') {
        return;
      }

      if (
        [
          'LoginAcid',
          'LoginEnterAlternateIdentifierSubtask',
          'LoginTwoFactorAuthChallenge',
        ].includes(taskId)
      ) {
        task.taskParameter = await this.resolveVerificationInput(
          response,
          credentials,
        );
      }

      if (!task.taskExecutor) {
        return;
      }

      response = await task.taskExecutor(
        flowToken,
        taskId,
        task.taskParameter,
      );
    }
  }

  createTaskMapper(
    username: string,
    password: string,
    verificationInputData?: string,
  ): Record<string, TaskMapping> {
    return {
      LoginJsInstrumentationSubtask: {
        taskExecutor: this.getUserFlowToken,
      },
      LoginEnterUserIdentifierSSO: {
        taskExecutor: this.getPasswordFlowToken,
        taskParameter: username,
      },
      LoginEnterAlternateIdentifierSubtask: {
        taskExecutor: this.handleSuspiciousLogin,
        taskParameter: verificationInputData,
      },
      LoginEnterPassword: {
        taskExecutor: this.getAccountDuplicationFlowToken,
        taskParameter: password,
      },
      DenyLoginSubtask: {
        taskExecutor: this.checkSuspiciousLogin,
      },
      AccountDuplicationCheck: {
        taskExecutor: this.checkAccountDuplication,
      },
      LoginAcid: {
        taskExecutor: this.handleSuspiciousLogin,
        taskParameter: verificationInputData,
      },
      LoginTwoFactorAuthChallenge: {
        taskExecutor: this.handleSuspiciousLogin,
        taskParameter: verificationInputData,
      },
      LoginSuccessSubtask: {
        taskOutput: 'Please Wait... Logging In...',
      },
    };
  }

  getFlowToken = async (): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      params: { flow_name: 'login' },
      json: {
        input_flow_data: {
          flow_context: {
            debug_overrides: {},
            start_location: { location: this.loginLocation() },
          },
        },
        subtask_versions: SUBTASK_VERSIONS,
      },
    });
  };

  getJavascriptInstrumentationSubtask = async (): Promise<
    Record<string, unknown>
  > => {
    return this.requestClient.request(X_PATHS.JAVSCRIPT_INSTRUMENTATION_URL, {
      params: { c_name: 'ui_metrics' },
    });
  };

  getUserFlowToken = async (
    flowToken: string,
    subtaskId = 'LoginJsInstrumentationSubtask',
  ): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      json: {
        flow_token: flowToken,
        subtask_inputs: [
          {
            subtask_id: subtaskId,
            js_instrumentation: {
              response: '',
              link: 'next_link',
            },
          },
        ],
      },
    });
  };

  getPasswordFlowToken = async (
    flowToken: string,
    subtaskId = 'LoginEnterUserIdentifierSSO',
    username?: string,
  ): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      json: {
        flow_token: flowToken,
        subtask_inputs: [
          {
            subtask_id: subtaskId,
            settings_list: {
              setting_responses: [
                {
                  key: 'user_identifier',
                  response_data: {
                    text_data: { result: username },
                  },
                },
              ],
              link: 'next_link',
            },
          },
        ],
      },
    });
  };

  getAccountDuplicationFlowToken = async (
    flowToken: string,
    subtaskId = 'LoginEnterPassword',
    password?: string,
  ): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      json: {
        flow_token: flowToken,
        subtask_inputs: [
          {
            subtask_id: subtaskId,
            enter_password: {
              password,
              link: 'next_link',
            },
          },
        ],
      },
    });
  };

  checkSuspiciousLogin = async (
    flowToken: string,
    subtaskId = 'DenyLoginSubtask',
  ): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      json: {
        flow_token: flowToken,
        subtask_inputs: [
          {
            subtask_id: subtaskId,
            cta: { link: 'next_link' },
          },
        ],
      },
    });
  };

  checkAccountDuplication = async (
    flowToken: string,
    subtaskId = 'AccountDuplicationCheck',
  ): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      json: {
        flow_token: flowToken,
        subtask_inputs: [
          {
            subtask_id: subtaskId,
            check_logged_in_account: {
              link: 'AccountDuplicationCheck_false',
            },
          },
        ],
      },
    });
  };

  handleSuspiciousLogin = async (
    flowToken: string,
    subtaskId = 'LoginAcid',
    verificationInputData?: string,
  ): Promise<Record<string, unknown>> => {
    return this.requestClient.request(X_PATHS.TASK_URL, {
      method: 'POST',
      skipErrorChecking: true,
      json: {
        flow_token: flowToken,
        subtask_inputs: [
          {
            subtask_id: subtaskId,
            enter_text: {
              text: verificationInputData,
              link: 'next_link',
            },
          },
        ],
      },
    });
  };

  private async resolveVerificationInput(
    response: Record<string, unknown>,
    credentials: LoginCredentials,
  ): Promise<string> {
    const inputType = String(findNestedValue(response, 'keyboard_type') ?? '')
      .trim()
      .toLowerCase();
    const hintMessage = String(findNestedValue(response, 'hint_text') ?? '')
      .trim()
      .toLowerCase();
    const twoFactor =
      inputType === 'number' &&
      hintMessage === 'enter code' &&
      credentials.mfaSecret;
    const input =
      ((inputType === 'telephone' || hintMessage === 'phone or username') &&
        credentials.phone) ||
      ((inputType === 'email' || hintMessage === 'phone or email') &&
        credentials.email) ||
      (twoFactor ? generateTotp(credentials.mfaSecret as string) : undefined) ||
      credentials.verificationCode ||
      (this.promptVerification
        ? await this.promptVerification(`${hintMessage} (${inputType})`)
        : undefined);

    if (!input) {
      throw new Error('Verification input is required.');
    }

    return input;
  }
}

function getSubtaskIds(response: Record<string, unknown>): string[] {
  const subtasks = response.subtasks;

  if (!Array.isArray(subtasks)) {
    return [];
  }

  return subtasks
    .map((task) =>
      isRecord(task) && typeof task.subtask_id === 'string'
        ? task.subtask_id
        : undefined,
    )
    .filter((value): value is string => Boolean(value));
}

function findNestedValue(source: unknown, key: string): unknown {
  if (Array.isArray(source)) {
    for (const item of source) {
      const result = findNestedValue(item, key);
      if (result !== undefined) {
        return result;
      }
    }
  }

  if (isRecord(source)) {
    if (key in source) {
      return source[key];
    }

    for (const value of Object.values(source)) {
      const result = findNestedValue(value, key);
      if (result !== undefined) {
        return result;
      }
    }
  }

  return undefined;
}

export function generateTotp(secret: string, now = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

function decodeBase32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = '';

  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value === -1) {
      throw new Error('Invalid base32 secret.');
    }

    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function randomLoginLocation(): 'splash_screen' | 'manual_link' {
  return Math.random() > 0.5 ? 'splash_screen' : 'manual_link';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
