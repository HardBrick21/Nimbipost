import { describe, expect, it } from 'vitest';
import { XLoginTaskHandler, generateTotp } from '../../src/platforms/x/login-task-handler';

describe('XLoginTaskHandler', () => {
  it('generates six digit TOTP codes from base32 MFA secrets', () => {
    expect(
      generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000),
    ).toBe('287082');
  });

  it('executes the TweeterPy login task flow main path', async () => {
    const requests: Array<{
      url: string;
      method?: string;
      params?: Record<string, string>;
      json?: unknown;
    }> = [];
    const responses = [
      { flow_token: 'flow-1', subtasks: [{ subtask_id: 'LoginJsInstrumentationSubtask' }] },
      { text: 'instrumentation-page' },
      { flow_token: 'flow-2', subtasks: [{ subtask_id: 'LoginEnterUserIdentifierSSO' }] },
      { flow_token: 'flow-3', subtasks: [{ subtask_id: 'LoginEnterPassword' }] },
      { flow_token: 'flow-4', subtasks: [{ subtask_id: 'AccountDuplicationCheck' }] },
      { flow_token: 'flow-5', subtasks: [{ subtask_id: 'LoginSuccessSubtask' }] },
    ];
    const handler = new XLoginTaskHandler({
      requestClient: {
        async request(url: string, options?: { method?: string; params?: Record<string, string>; json?: unknown }) {
          requests.push({ url, ...options });
          const response = responses.shift();
          if (!response) {
            throw new Error('No fake response configured');
          }

          return response;
        },
      },
      loginLocation: () => 'manual_link',
    });

    await handler.login({
      username: 'user',
      password: 'pass',
    });

    expect(requests.map((request) => request.url)).toEqual([
      'https://api.x.com/1.1/onboarding/task.json',
      'https://twitter.com/i/js_inst',
      'https://api.x.com/1.1/onboarding/task.json',
      'https://api.x.com/1.1/onboarding/task.json',
      'https://api.x.com/1.1/onboarding/task.json',
      'https://api.x.com/1.1/onboarding/task.json',
    ]);
    expect(requests[0].params).toEqual({ flow_name: 'login' });
    expect(requests[0].json).toMatchObject({
      input_flow_data: {
        flow_context: {
          start_location: { location: 'manual_link' },
        },
      },
    });
    expect(requests[3].json).toMatchObject({
      subtask_inputs: [
        {
          subtask_id: 'LoginEnterUserIdentifierSSO',
          settings_list: {
            setting_responses: [
              {
                key: 'user_identifier',
                response_data: { text_data: { result: 'user' } },
              },
            ],
          },
        },
      ],
    });
    expect(requests[4].json).toMatchObject({
      subtask_inputs: [
        {
          subtask_id: 'LoginEnterPassword',
          enter_password: { password: 'pass', link: 'next_link' },
        },
      ],
    });
    expect(requests[5].json).toMatchObject({
      subtask_inputs: [
        {
          subtask_id: 'AccountDuplicationCheck',
          check_logged_in_account: {
            link: 'AccountDuplicationCheck_false',
          },
        },
      ],
    });
  });
});
