import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as docker from "@pulumi/docker";
import * as fs from "fs";
import { Output } from "@pulumi/pulumi";

const imageName = "my-first-gcp-app";
const config = new pulumi.Config();
//const codePath = config.require('projectLocation');

// get configuration
const appPort = config.requireNumber("app_port");
const nodeEnvironment = config.require("node_environment");

// get custom configuration
const cloudAdmin = "cloud-admin";
const cloudLocation = "us-central1";
const myAppName = "my-app";

const stack = pulumi.getStack();

const backendImageName = "backend-2";

const backend = new docker.Image(backendImageName, {
    build: {
        context: `${process.cwd()}/cloud-admin`,
    },
    imageName: pulumi.interpolate`gcr.io/${gcp.config.project}/${imageName}:latest`
});

// create a network!
const network = new docker.Network("network", {
    name: `services-${stack}`,
});

// create the backend container!
const backendContainer = new docker.Container("backendContainer", {
    name: `backend-${stack}`,
    image: backend.baseImageName,
    ports: [
        {
            internal: appPort,
            external: 80,
        },
    ],
    envs: [
        `NODE_ENV=${nodeEnvironment}`,
    ],
    networksAdvanced: [
        {
            name: network.name,
        },
    ],
}, { dependsOn: [] });


const containerService = new gcp.cloudrun.Service("my-app-2", {
    name: "my-app-2",
    location: "us-central1",
    template: {
        spec: {
            containers: [
                {
                    image: backend.imageName,
                    ports: [{
                        containerPort: 80,
                    }],
                    resources: {
                        requests: {
                            memory: "64Mi",
                            cpu: "200m",
                        },
                        limits: {
                            memory: "256Mi",
                            cpu: "1000m",
                        },
                    },
                },
            ],
            containerConcurrency: 80,
            /*containers: [{
                image: "us-docker.pkg.dev/cloudrun/container/hello",
            }],*/
        },
    },
    traffics: [{
        latestRevision: true,
        percent: 100,
    }],
});

// Open the service to public unrestricted access
const iam = new gcp.cloudrun.IamMember("website-2", {
    service: containerService.name,
    location: "us-central1",
    role: "roles/run.invoker",
    member: "allUsers",
});

// Export the URL
export const containerUrl = containerService.statuses[0].url

function GetValue<T>(output: Output<T>) {
    return new Promise<T>((resolve, reject)=>{
        output.apply(value=>{
            resolve(value);
        });
    });
}

(async()=>{
    fs.writeFileSync("PulumiOutput_Public.txt", JSON.stringify({
        registryURL: await GetValue(containerUrl)
    }));
})();

export const out = GetValue(containerUrl);

console.log("---- out -----", out);


/*function split(input: pulumi.Input<string>): pulumi.Output<string[]> {
    let output = pulumi.output(input);
    return output.apply(v => v.split());
}*/
