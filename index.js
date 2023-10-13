const { exec, spawn } = require("child_process");
const { NodeSSH } = require("node-ssh");

// FRONTEND
const commandImageId = `docker images jcordova1993/agro-app --format "{{.ID}}"`;
let dockerImageId;
exec(commandImageId, (error, stdout, stderr) => {
  notify("[Initiating...]");
  if (error) {
    console.log(`error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }

  dockerImageId = stdout;
  if (!dockerImageId) {
    console.error("Docker Image not found");
  }

  if (dockerImageId) {
    console.log("Removing docker image...");
    exec(`docker rmi -f ${dockerImageId}`, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      createNewImage();
      //   updateAWSInstance();
    });
  } else {
    createNewImage();
    // updateAWSInstance();
  }
});

function createNewImage() {
  console.log("Creating new image...");
  const DIRECTORY =
    "/home/dsy/Documents/Projects/creandolo/agroconectados-frontend/"; // TODO: Change this to your directory

  const buildingImage = spawn(
    "docker",
    ["build", "-t", "jcordova1993/agro-app", "--no-cache", "."],
    { cwd: DIRECTORY }
  );

  buildingImage.on("error", (error) => {
    console.log(`error creating new image: ${error.message}`);
    notify("[ERROR creating new image]");
  });

  buildingImage.stdout.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });

  buildingImage.on("close", (code) => {
    if (code == "0") {
      console.log("Image created successfully");
      console.log("Sending image to Docker Hub");
      exec(`docker push jcordova1993/agro-app`, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          notify("[ERROR pushing to Docker]");
          return;
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          notify("[ERROR pushing to Docker]");
          return;
        }
        notify("[Image Pushed OK]");
        updateAWSInstance();
      });
    } else {
      notify("[ERROR creating new image]");
    }
  });
}

function updateAWSInstance() {
  const ssh = new NodeSSH();
  let dockerImageId;
  console.log("Connecting with AWS instance");
  ssh
    .connect({
      host: "54.157.151.5",
      username: "ubuntu",
      privateKeyPath: "/home/dsy/.ssh/agroconectados.pem", // TODO: Change this to your private key path
    })
    .then(() => {
      console.log("Connected with AWS instance...");
      ssh
        .execCommand("docker-compose down", {
          cwd: "/home/ubuntu/project/agroconectados-frontend",
        })
        .then(function (result) {
          console.log("STDOUT: " + result.stdout);
          console.log("STDERR: " + result.stderr);
          if (result.code == "0") {
            console.log("Application Stopped");
            ssh
              .execCommand(
                `docker images jcordova1993/agro-app --format "{{.ID}}"`,
                {
                  cwd: "/home/ubuntu/project/agroconectados-frontend",
                }
              )
              .then(function (result) {
                if (result.code == "0") {
                  dockerImageId = result.stdout;
                  console.log("Removing images");
                  ssh
                    .execCommand(`docker rmi -f ${dockerImageId}`, {
                      cwd: "/home/ubuntu/project/agroconectados-frontend",
                    })
                    .then(function (result) {
                      if (result.code == "0") {
                        console.log("Image  Removed");
                        console.log(
                          "Downloading and Initializing App Again..."
                        );
                        ssh
                          .execCommand(`docker-compose up -d --build`, {
                            cwd: "/home/ubuntu/project/agroconectados-frontend",
                          })
                          .then(function (result) {
                            if (result.code == "0") {
                              console.log("App Deployed ");
                              notify("[Everything OK]");
                              process.exit(0);
                            } else {
                              console.log("STDERR: " + result.stderr);
                              notify("[ERROR initializing app in AWS]");
                              process.exit(1);
                            }
                          });
                      } else {
                        console.log("STDERR: " + result.stderr);
                        notify("[ERROR removing image in AWS]");
                        process.exit(1);
                      }
                    });
                } else {
                  console.log("STDERR: " + result.stderr);
                  notify("[ERROR finding image in AWS]");
                  process.exit(1);
                }
              });
          }
        });
    })
    .catch((err) => {
      console.log("ERROR connecting with AWS", err);
      notify("[ERROR in AWS]");
      process.exit(1);
    });
}

function notify(message) {
  exec(
    `curl -X POST -H "Content-Type: application/json" -d '{"value1":"${message}"}' https://maker.ifttt.com/trigger/Deployment/with/key/g9GgBLBR0Qsw6eqlLgKgkjlwifwHoCiri0huJNnLTv6

  `,
    (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
    }
  );
}
