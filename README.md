# Probot: Censor

> a GitHub App built with [probot](https://github.com/probot/probot) that removes sensitive stuff
> from issues, pull requests and comments

## Usage

1. **[Configure the GitHub App](https://github.com/apps/censor)**
2. Create `.github/censor.yml` based on the following template
3. It will start scanning for sensitive information in issues and comments and edit them.

A `.github/censor.yml` file is required to enable the plugin. The file must specify rules for the
bot to scan in the following format:

```yaml
# An optional generic message to reply after censoring
message: "Hi there, I just edited this for you."
# The required list of rules
rules:
    # A required pattern to scan for. Accepts anything that is a valid JavaScript regluar expression
  - pattern: "(private_key|auth_token)=\w+"
    # The text to replace all matches with. Can refer to matching groups with $
    replacement: "$1=🔑"
    # Optional modifiers for the above regular expression. Defaults to "gi"
    modifier: "gi"
    # Optional message to reply to if this rule matches. If empty, no message is sent
    message: "Please **never post your private tokens**."
```

## Development

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Deployment

If you would like to run your own instance of this app, see the [docs for deployment](https://probot.github.io/docs/deployment/).

This app requires these **Permissions** for the GitHub App:

 - **Repository contents**: Read-only
 - **Issues**: Read & write
 - **Pull requests**: Read & write

Also, the following **Events** need to be subscribed:

 - **Issues**: Issue opened or edited
 - **Pull request**: Pull request opened or edited
 - **Issue comment**: Issue comment created, edited, or deleted
