const {createRobot} = require('probot');

jest.mock('probot-config', () => {
  const config = {
    message: 'I just edited this for you',
    rules: [
      {
        pattern: '(api_token=)\\w+',
        replacement: '$1redacted',
        message: 'do not post your api token'
      }
    ]
  };
  return () => Promise.resolve(config);
});
const plugin = require('..');

describe('probot-censor', () =>  {
  let robot;
  let github;
  let payloads;

  beforeEach(() => {
    robot = createRobot();
    plugin(robot);

    github = {
      issues: {
        createComment: jest.fn(() => Promise.resolve()),
        editComment: jest.fn(() => Promise.resolve()),
        edit: jest.fn(() => Promise.resolve()),
      }
    };

    robot.auth = () => Promise.resolve(github);
    payloads = {
      issue: {
        id: 123,
        event: 'issues',
        payload: {
          action: 'opened',
          repository: {
            name: 'sentry',
            owner: {
              login: 'getsentry',
            }
          },
          issue: {
            number: 21,
            user: {
              login: 'dr_example'
            },
            title: 'Issue title',
            body: 'api_token=deadbeef012 '
          },
          installation: {
            id: 99
          }
        }
      },
      pull_request: {
        id: 456,
        event: 'pull_request',
        payload: {
          action: 'opened',
          repository: {
            name: 'sentry',
            owner: {
              login: 'getsentry',
            }
          },
          pull_request: {
            number: 21,
            user: {
              login: 'dr_example'
            },
            title: 'Pull Request title',
            body: 'Here is my api_token=deadbeef012',
          },
          installation: {
            id: 99
          }
        }
      },
      comment: {
        id: 789,
        event: 'issue_comment',
        payload: {
          action: 'created',
          repository: {
            name: 'sentry',
            owner: {
              login: 'getsentry',
            }
          },
          comment: {
            user: {
              login: 'dr_evil',
            },
            body: 'Found my api_token=deadbeef012'
          },
          installation: {
            id: 99
          }
        }
      }
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('issue updating', () => {
    it('updates issue description', async () => {
      await robot.receive(payloads.issue);

      const mockEdit = github.issues.edit.mock;
      expect(mockEdit.calls.length).toBe(1);
      expect(mockEdit.calls[0][0].body).toEqual(expect.not.stringContaining('deadbeef'));
      expect(mockEdit.calls[0][0].body).toEqual(expect.stringContaining('api_token=redacted'));

      const mockCreate = github.issues.createComment.mock;
      expect(mockCreate.calls.length).toBe(1);
      expect(mockCreate.calls[0][0].body).toEqual(expect.stringContaining('do not post'));
    });

    it('ignores cycles', async () => {
      const payload = payloads.issue;
      // Simulate a replacement from another rule
      payload.payload.issue.changes = {
        body: {
          from: 'api_token=abcdef'
        }
      };
      payload.payload.issue.body = 'api_token=redacted';
      await robot.receive(payloads.issue);

      const mockEdit = github.issues.edit.mock;
      // No edits made as content is already clean.
      expect(mockEdit.calls.length).toBe(0);
    });
  });

  describe('pull_request updating', () => {
    it('updates descriptions', async () => {
      await robot.receive(payloads.pull_request);

      const mockEdit = github.issues.edit.mock;
      expect(mockEdit.calls.length).toBe(1);
      expect(mockEdit.calls[0][0].body).toEqual(expect.not.stringContaining('deadbeef'));
      expect(mockEdit.calls[0][0].body).toEqual(expect.stringContaining('api_token=redacted'));

      const mockCreate = github.issues.createComment.mock;
      expect(mockCreate.calls.length).toBe(1);
      expect(mockCreate.calls[0][0].body).toEqual(expect.stringContaining('do not post'));
    });
  });


  describe('issue_comment updating', () => {
    it('updates comment', async () => {
      await robot.receive(payloads.comment);

      // Issue content should not change.
      expect(github.issues.edit.mock.calls.length).toBe(0);

      const mockEdit = github.issues.editComment.mock;
      expect(mockEdit.calls.length).toBe(1);
      expect(mockEdit.calls[0][0].body).toEqual(expect.not.stringContaining('deadbeef'));
      expect(mockEdit.calls[0][0].body).toEqual(expect.stringContaining('api_token=redacted'));

      const mockCreate = github.issues.createComment.mock;
      expect(mockCreate.calls.length).toBe(1);
      expect(mockCreate.calls[0][0].body).toEqual(expect.stringContaining('do not post'));
    });
  });
});
