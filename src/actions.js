const axios = require("axios");
const github = require("@actions/github");
const core = require("@actions/core");

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const SLACK_WEBHOOK_URL = core.getInput("SLACK_WEBHOOK_URL");
const TARGET_BRANCH = core.getInput("TARGET_BRANCH");
// const DESTINATION_BRANCH = core.getInput("DESTINATION_BRANCH");
const SLACK_WEBHOOK_REVIEW_URL = core.getInput("SLACK_WEBHOOK_REVIEW_URL");
const TEAM_LEAD_ID = core.getInput("TEAM_LEAD_ID");
const TECH_LEAD_ID = core.getInput("TECH_LEAD_ID");
const REPO_OWNER = core.getInput("REPO_OWNER");
const REPO_NAME = core.getInput("REPO_NAME");
const octokit = github.getOctokit(GITHUB_TOKEN);

const run = async () => {
  try {
    let pulls;
    pulls = await octokit.request(
      `GET /repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
      {
        owner: REPO_OWNER,
        repo: REPO_NAME,
        base: TARGET_BRANCH,
        state: "opened",
      }
    );
    pulls = pulls?.data.reverse();
    console.log("pulls,", pulls?.length);
    if (pulls?.length > 0) {
      // for (let i = 0; i < pulls?.length; i++) {
      pulls?.forEach(async (pull) => {
        // const pull = pulls[i];
        let pull_number = pull?.number;
        let description = pull.body;
        let createdAt = pull.updated_at;
        let branch = pull.head.ref;
        console.log(`pull`, pull?.number);
        const pull_commits = await octokit.request(
          `GET /repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}/commits`,
          {
            owner: REPO_OWNER,
            repo: REPO_NAME,
            pull_number,
          }
        );
        let commits = "";
        pull_commits?.data?.forEach((e, i) => {
          if (
            !e?.commit?.message.includes("Merge") &&
            !e?.commit?.message.includes("Merged") &&
            !e?.commit?.message.includes("skip") &&
            !e?.commit?.message.includes("Skip")
          )
            commits =
              i === 0
                ? "> " + e.commit.message
                : commits + "\n\n" + "> " + e.commit.message;
        });
        // merge pr
        const mergepr = await octokit.request(
          `PUT /repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}/merge`,
          {
            owner: REPO_OWNER,
            repo: REPO_NAME,
            pull_number,
          }
        );
        if (mergepr?.data) {
          // create/update PR to master
          const createpr = await createorupdatepr({
            branch,
            body: description,
            owner: REPO_OWNER,
            repo: REPO_NAME,
            full_name: `${REPO_OWNER}/${REPO_NAME}`,
          });
          console.log("createpr", createpr);
          if (createpr?.data) {
            let newDate = new Date();
            newDate.setTime(new Date(createdAt).getTime());
            let dateString = newDate.toDateString();
            let timeString = newDate.toLocaleTimeString();
            const options = {
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: ":sparkles:  New post for manual review on engineering blog",
                    emoji: true,
                  },
                },
                {
                  type: "context",
                  elements: [
                    {
                      text: `<@${TEAM_LEAD_ID}> <@${TECH_LEAD_ID}> <@${TEAM_LEAD_ID}>  |  *engineering blog*  |  *${
                        dateString + " " + timeString
                      }* `,
                      type: "mrkdwn",
                    },
                  ],
                },
                {
                  type: "divider",
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*<https://github.com/${REPO_OWNER}/${REPO_NAME}/pulls/${createpr?.data?.number} | ${branch}>*`,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `${commits ?? "No commits to display"}`,
                  },
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        emoji: true,
                        text: "Review Changes",
                      },
                      style: "primary",
                      url: "https://staging--getpaidafrica.netlify.app/",
                    },
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        emoji: true,
                        text: "View Pull Request",
                      },
                      url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/pulls/${createpr?.data?.number}`,
                    },
                  ],
                },
              ],
            };
            axios
              .post(SLACK_WEBHOOK_REVIEW_URL, JSON.stringify(options))
              .then((response) => {
                console.log("SUCCEEDED: Sent slack webhook", response.data);
              })
              .catch((error) => {
                console.log("FAILED: Send slack webhook", error);
              });
            return;
          }
        }
      });
    } else {
      console.log("There are no pull requests to review");
      let options = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "New notification sent from github actions",
              emoji: true,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `❌ There are no pull requests to review`,
              },
            ],
          },
        ],
      };
      axios
        .post(SLACK_WEBHOOK_URL, JSON.stringify(options))
        .then((response) => {
          console.log("SUCCEEDED: Sent slack webhook", response.data);
        })
        .catch((error) => {
          console.log("FAILED: Send slack webhook", error);
        });
      return;
    }
  } catch (error) {
    console.log("error,", error.message);
  }
};

run();

const createorupdatepr = async ({ branch, owner, repo, body, full_name }) => {
  try {
    const existing_pr = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      head: owner + ":" + branch,
      base: "master",
    });
    if (existing_pr?.data?.length === 0) {
      // create new pr
      const createpr = await octokit.request(`POST /repos/${full_name}/pulls`, {
        owner,
        repo,
        title: branch,
        body,
        head: branch,
        base: "master",
      });
      return createpr;
    } else {
      // update existing pr
      const updatepr = await octokit.rest.pulls.update({
        pull_number: existing_pr?.data[0].number,
        owner,
        repo,
        title: branch,
        body,
        head: branch,
        base: "master",
      });
      return updatepr;
    }
  } catch (error) {
    console.log(error.message);
    let options = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "New notification sent from github actions",
            emoji: true,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `❌ failed to create pull request to master due to - ${error?.message}`,
            },
          ],
        },
      ],
    };
    axios
      .post(SLACK_WEBHOOK_URL, JSON.stringify(options))
      .then((response) => {
        console.log("SUCCEEDED: Sent slack webhook", response.data);
      })
      .catch((error) => {
        console.log("FAILED: Send slack webhook", error);
      });
  }
};
