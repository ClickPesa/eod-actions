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
        console.log(pull_number, description, createdAt, branch);
        const commits = await octokit.request(
          `GET /repos/${context.payload?.repository?.full_name}/pulls/${pull_number}/commits`,
          {
            owner: context.payload?.repository?.owner?.login,
            repo: context.payload?.repository?.name,
            pull_number,
          }
        );
        console.log(commits);
      });
    } else {
      console.log("There are no pull requests to review");
      let options = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌  New notification sent from github actions",
              emoji: true,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `> There are no pull requests to review`,
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

// gulp.task("createnotification", async () => {
//   const options = {
//     blocks: [
//       {
//         type: "header",
//         text: {
//           type: "plain_text",
//           text: ":sparkles:  New notification sent via github actions",
//           emoji: true,
//         },
//       },
//       {
//         type: "context",
//         elements: [
//           {
//             text: `<@null> <@null> <@null>  |  *engineering blog*  |  *null}* `,
//             type: "mrkdwn",
//           },
//         ],
//       },
//       {
//         type: "divider",
//       },
//       {
//         type: "section",
//         text: {
//           type: "mrkdwn",
//           text: `*<https://github.com/clickpesa/engineering-blog/pulls>*`,
//         },
//       },
//       {
//         type: "section",
//         text: {
//           type: "mrkdwn",
//           text: `sample from from github`,
//         },
//       },
//       {
//         type: "actions",
//         elements: [
//           {
//             type: "button",
//             text: {
//               type: "plain_text",
//               emoji: true,
//               text: "Review Changes",
//             },
//             style: "primary",
//             url: "https://staging--getpaidafrica.netlify.app//",
//           },
//           {
//             type: "button",
//             text: {
//               type: "plain_text",
//               emoji: true,
//               text: "View Pull Request",
//             },
//             url: `https://github.com/clickpesa/engineering-blog/pulls`,
//           },
//         ],
//       },
//     ],
//   };
//   axios
//     .post(`${process.argv[4]}`, JSON.stringify(options))
//     .then((response) => {
//       console.log("SUCCEEDED: Sent slack webhook", response.data);
//       resolve(response.data);
//     })
//     .catch((error) => {
//       console.log("FAILED: Send slack webhook", error);
//       reject(new Error("FAILED: Send slack webhook"));
//     });
// });

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
