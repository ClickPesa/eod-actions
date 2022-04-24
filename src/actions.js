const axios = require("axios");
const github = require("@actions/github");
const core = require("@actions/core");

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const SLACK_WEBHOOK_URL = core.getInput("SLACK_WEBHOOK_URL");
const TARGET_BRANCH = core.getInput("TARGET_BRANCH");
const DESTINATION_BRANCH = core.getInput("DESTINATION_BRANCH");
const SLACK_WEBHOOK_REVIEW_URL = core.getInput("SLACK_WEBHOOK_REVIEW_URL");
const octokit = github.getOctokit(GITHUB_TOKEN);
const { context = {} } = github;

const run = async () => {
  try {
    const pulls = await octokit.request(
      `GET /repos/${context.payload?.repository?.full_name}/pulls`,
      {
        owner: context.payload?.repository?.owner?.login,
        repo: context.payload?.repository?.name,
        base: TARGET_BRANCH,
        state: "opened",
      }
    );
    if (pulls?.data?.length > 0) {
      pulls?.data.forEach(async (pull) => {
        let pull_number = pull?.number;
        let description = pull.body;
        let createdAt = pull.updated_at;
        let branch = pull.head.ref;
        const pull_commits = await octokit.request(
          `GET /repos/${context.payload?.repository?.full_name}/pulls/${pull_number}/commits`,
          {
            owner: context.payload?.repository?.owner?.login,
            repo: context.payload?.repository?.name,
            pull_number,
          }
        );
        let commits = "";
        console.log("pull commits", pull_commits?.data);
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
        console.log("commits", commits);
        // merge pr
        const mergepr = await octokit.request(
          `PUT /repos/${context.payload?.repository?.full_name}/pulls/${pull_number}/merge`,
          {
            owner: context.payload?.repository?.owner?.login,
            repo: context.payload?.repository?.name,
            pull_number,
          }
        );
        if (mergepr?.data) {
          // create/update PR to master
          const createpr = await createorupdatepr({
            branch,
            body: description,
            owner: context.payload?.repository?.owner?.login,
            repo: context.payload?.repository?.name,
            full_name: context.payload?.repository?.full_name,
          });
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
                    text: ":sparkles:  New post from engineering blog that requires review",
                    emoji: true,
                  },
                },
                {
                  type: "context",
                  elements: [
                    {
                      text: `<@null> <@null> <@null>  |  *engineering blog*  |  *${
                        dateString + " " + timeString
                      }}* `,
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
                    text: `*<https://github.com/${context.payload?.repository?.full_name}/pulls/${createpr?.data?.number}>*`,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `${commits}`,
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
                      url: `https://github.com/${context.payload?.repository?.full_name}/pulls/${pull_number}`,
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
    console.log(error.message);
  }
};

run();

const createorupdatepr = async ({ branch, owner, repo, body, full_name }) => {
  try {
    const existing_pr = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      head: branch,
      base: DESTINATION_BRANCH,
    });
    console.log("existing pr", existing_pr?.data);
    if (existing_pr?.data?.length === 0) {
      // create new pr
      const createpr = await octokit.request(`POST /repos/${full_name}/pulls`, {
        owner,
        repo,
        title: branch,
        body,
        head: branch,
        base: DESTINATION_BRANCH,
      });
      console.log("create pr", createpr?.data);
      return createpr;
    } else {
      // update existing pr
      console.log("there");
      const updatepr = await octokit.rest.pulls.update({
        pull_number: existing_pr?.data[0].number,
        owner,
        repo,
        title: branch,
        body,
        head: branch,
        base: DESTINATION_BRANCH,
      });
      console.log("update pr", updatepr?.data);
      return updatepr;
    }
  } catch (error) {
    console.log(error.message);
  }
};

// gulp.task("getpulls", async () => {
//   try {
//     const octokit = new Octokit({ auth: process.argv[4] });
//     console.log("pulls", pulls?.data);

//     const pull = await octokit.request("GET /repos/bmsteven/demo/pulls/18", {
//       owner: "bmsteven",
//       repo: "demo",
//       pull_number: "18",
//     });
//     console.log("pull", pull?.data);
//     // update pull request
//     // get pull request commits
//     // check if pull request was merged
//     const checkPulls = await octokit.request(
//       "GET /repos/bmsteven/demo/pulls/18/merge",
//       {
//         owner: "bmsteven",
//         repo: "demo",
//         pull_number: "18",
//       }
//     );
//     console.log("checkPulls", checkPulls?.data);
//     // merge pull request
//     const mergepr = await octokit.request(
//       "PUT /repos/bmsteven/demo/pulls/16/merge",
//       {
//         owner: "bmsteven",
//         repo: "demo",
//         pull_number: "18",
//       }
//     );
//     console.log("mergepr", mergepr?.data);
//     // create new pull request
//   } catch (error) {
//     console.log(error?.message);
//   }
// });

// // name: NodeJS with Gulp

// // on:
// //   push:
// //     branches: [ develop ]
// //     paths: ["gulpfile.js"]
// //   pull_request:
// //     branches: [ develop ]
// //     paths: ["gulpfile.js"]

// // jobs:
// //   build:
// //     runs-on: ubuntu-latest

// //     strategy:
// //       fail-fast: false
// //       matrix:
// //         node-version: [12.x, 14.x, 16.x]

// //     steps:
// //     - uses: actions/checkout@v3

// //     - name: Use Node.js ${{ matrix.node-version }}
// //       uses: actions/setup-node@v3
// //       with:
// //         node-version: ${{ matrix.node-version }}

// //     - name: Build
// //       run: npm install

// //     - name: gulp
// //       run: npm install -g gulp axios @octokit/core

// //     - name: notify
// //       # run: gulp createnotification --b ${{ secrets.SLACK_WEBHOOK_URL }}
// //       run: gulp getpulls --b ${{ secrets.TOKEN }}
