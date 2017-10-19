const { shouldPerform } = require('dryrun');
const getConfig = require('probot-config');

/**
 * Configuration file used to activate this bot
 */
const CONFIG_NAME = 'censor.yml';

/**
 * Default modifier used for RegExp
 */
const DEFAULT_MODIFIER = 'gi';

/**
 * Internal cache for tags by repository
 */
let logger;

/**
 * Checks the body of the subject and edits it if it violates one of the
 * configured rules
 *
 * @param {Context} context A github context
 * @param {string} type The type (issue, pull_request or comment) of this event
 * @returns {Promise} A promise that resolves after this event has been handled
 * @async
 */
async function handleEvent(context, type) {
  const { action } = context.payload;
  if (action !== 'opened' && action !== 'edited' && action !== 'created') {
    return;
  }

  // Only proceed if there is a config and it defines rules
  const config = await getConfig(context, CONFIG_NAME);
  const rules = config && config.rules;
  if (rules == null) {
    return;
  }

  const triggeredRules = [];
  const item = context.payload[type];
  const body = item.body;

  // Get the previous body, if any. This allows us to detect loops
  // or skip instances where one rule triggers another
  const prev = context.payload.changes
    ? context.payload.changes.body.from
    : '';

  const newBody = rules.reduce((currentBody, rule) => {
    const regex = new RegExp(rule.pattern, rule.modifier || DEFAULT_MODIFIER);

    if (!currentBody.match(regex)) {
      // Ignore if the rule does not match at all
      return currentBody;
    }

    if (prev.match(regex)) {
      // If the rule was violated before, we're likely in a loop
      // Break out of it now
      return currentBody;
    }

    // Remember this rule to add a message.
    triggeredRules.push(rule);
    return currentBody.replace(regex, rule.replacement || '');
  }, body || '');

  if (newBody === body) {
    return;
  }

  // Something has changed, so we can build an edit request
  const edit = context.issue({ body: newBody, id: item.id });
  const slug = `${edit.owner}/${edit.repo}#${edit.number}-${edit.id}`;
  logger.info(`Editing ${slug} due to ${triggeredRules.length} violated rules`);
  logger.debug(`Changing ${type}`, edit);

  if (shouldPerform()) {
    if (type === 'comment') {
      await context.github.issues.editComment(edit);
    } else {
      await context.github.issues.edit(edit);
    }
  }

  // Try to construct a message to comment to the issue from the general
  // message template or individual rule messages
  const message = [config.message]
    .concat(triggeredRules.map(rule => rule.message))
    .filter(msg => !!msg)
    .join(' ')
    .trim();

  if (message === '') {
    logger.debug('Skipping comment as no messages are configured');
    return;
  }

  // Always comment to the isse, regardless of whether this was an issue
  // or a comment
  const comment = context.issue({ body: message });
  logger.debug('Posting comment:', comment);

  if (shouldPerform()) {
    await context.github.issues.createComment(comment);
  }
}

module.exports = (robot) => {
  logger = robot.log;

  // see https://developer.github.com/v3/activity/events/types/#issuesevent
  robot.on('issues', context => handleEvent(context, 'issue'));
  // see https://developer.github.com/v3/activity/events/types/#pullrequestevent
  robot.on('pull_request', context => handleEvent(context, 'pull_request'));
  // see https://developer.github.com/v3/activity/events/types/#issuecommentevent
  robot.on('issue_comment', context => handleEvent(context, 'comment'));
};
