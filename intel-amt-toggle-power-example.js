#!/usr/bin/node

import CreateWsmanComm from 'meshcentral/amt/amt-wsman-comm.js';
import WsmanStackCreateService from 'meshcentral/amt/amt-wsman.js';
import AmtStackCreateService from 'meshcentral/amt/amt.js';

var settings = {
    hostname: "SET-WITH-YOUR-REMOTE-SYSTEM-IP-ADDRESS-OR-HOSTNAME",
    tls: false,
    username: "admin",
    password: "SET-WITH-YOUR-REMOTE-SYSTEM-PASSWORD",
};

function guidToString(g) {
    return g.substring(6, 8) + g.substring(4, 6) + g.substring(2, 4) + g.substring(0, 2) + "-" + g.substring(10, 12) + g.substring(8, 10) + "-" + g.substring(14, 16) + g.substring(12, 14) + "-" + g.substring(16, 20) + "-" + g.substring(20);
}

function promisifyMeshCentralAmtGet(amt) {
    return (operationName, tag, pri) => {
        return new Promise((resolve, reject) => {
            amt.Get(operationName, (stack, name, response, status, tag) => {
                switch (status) {
                    case 200:
                        resolve(response.Body);
                        break;
                    case 401:
                        reject(new Error("Invalid username, password, or insufficient permissions."));
                        break;
                    default:
                        reject(new Error("Request failed with status code " + status + " (" + JSON.stringify(response) + ")"));
                        break;
                }
            }, tag, pri);
        });
    };
}

function promisifyMeshCentralAmtExec(amt) {
    return (className, operationName, operationArguments, tag, pri) => {
        return new Promise((resolve, reject) => {
            amt.Exec(className, operationName, operationArguments, (stack, name, response, status) => {
                switch (status) {
                    case 200:
                        resolve(response.Body);
                        break;
                    case 401:
                        reject(new Error("Invalid username, password, or insufficient permissions."));
                        break;
                    default:
                        reject(new Error("Request failed with status code " + status + " (" + JSON.stringify(response) + ")"));
                        break;
                }
            }, tag, pri);
        });
    };
}

function promisifyMeshCentralAmtEnum(amt) {
    return (name, tag, pri) => {
        return new Promise((resolve, reject) => {
            amt.Enum(name, (stack, name, responses, status) => {
                switch (status) {
                    case 200:
                        resolve(responses);
                        break;
                    case 401:
                        reject(new Error("Invalid username, password, or insufficient permissions."));
                        break;
                    default:
                        reject(new Error("Request failed with status code " + status + " (" + JSON.stringify(response) + ")"));
                        break;
                }
            }, tag, pri);
        });
    };
}

function promisifyMeshCentralAmtRequestPowerStateChange(amt) {
    return (powerState) => {
        return new Promise((resolve, reject) => {
            amt.RequestPowerStateChange(powerState, (stack, name, response, status) => {
                switch (status) {
                    case 200:
                        resolve(response.Body);
                        break;
                    case 401:
                        reject(new Error("Invalid username, password, or insufficient permissions."));
                        break;
                    default:
                        reject(new Error("Request failed with status code " + status + " (" + JSON.stringify(response) + ")"));
                        break;
                }
            });
        });
    };
}

function sleep(ms) {
    return new Promise((resolve, _reject) => setTimeout(resolve, ms));
}

// see https://github.com/intel/lms/blob/f7c374745ae7efb3ed7860fdc3f8abbb52dc9f8f/CIM_Framework/CIMFramework/CPPClasses/Include/CIM_AssociatedPowerManagementService.h#L143-L159
// see https://schemas.dmtf.org/wbem/cim-html/2.49.0/CIM_AssociatedPowerManagementService.html
// see https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/default.htm?turl=HTMLDocuments%2FWS-Management_Class_Reference%2FCIM_AssociatedPowerManagementService.htm
const DmtfPowerStatesStrings = [
    "Unknown",                              // 0
    "Other",                                // 1
    "On",                                   // 2
    "Sleep - Light",                        // 3
    "Sleep - Deep",                         // 4
    "Power Cycle (Off - Soft)",             // 5
    "Off - Hard",                           // 6
    "Hibernate (Off - Soft)",               // 7
    "Off - Soft",                           // 8
    "Power Cycle (Off - Hard)",             // 9
    "Master Bus Reset",                     // 10
    "Diagnostic Interrupt (NMI)",           // 11
    "Off - Soft Graceful",                  // 12
    "Off - Hard Graceful",                  // 13
    "Master Bus Reset Graceful",            // 14
    "Power Cycle (Off - Soft Graceful)",    // 15
    "Power Cycle (Off - Hard Graceful)",    // 16
    "Diagnostic Interrupt (INIT)",          // 17
];
const DmtfPowerStateOn                      = 2;
const DmtfPowerStatePowerCycleSoft          = 5;
const DmtfPowerStateOffHard                 = 6;
const DmtfPowerStateOffSoft                 = 8;
const DmtfPowerStateOffHardGraceful         = 13;
const DmtfPowerStateOffSoftGraceful         = 12;
const DmtfPowerStateMasterBusReset          = 10;
const DmtfPowerStateDiagnosticInterruptNmi  = 11;

function getDmtfPowerStateString(powerStateId) {
    if (powerStateId >= 0 && powerStateId < DmtfPowerStatesStrings.length) {
        return `#${powerStateId} (${DmtfPowerStatesStrings[powerStateId]})`;
    }
    return `#${powerStateId}`;
}

class Amt {
    constructor(settings) {
        this._amtUrl = `http${settings.tls ? 's' : ''}://${settings.hostname}:${settings.tls ? 16993 : 16992}`;
        const comm = CreateWsmanComm(
            settings.hostname,
            settings.tls ? 16993 : 16992,
            settings.username,
            settings.password,
            settings.tls ? 1 : 0);
        const wsstack = WsmanStackCreateService(comm);
        this._amt = AmtStackCreateService(wsstack);
        this._get = promisifyMeshCentralAmtGet(this._amt);
        this._exec = promisifyMeshCentralAmtExec(this._amt);
        this._enum = promisifyMeshCentralAmtEnum(this._amt);
        this._requestPowerStateChange = promisifyMeshCentralAmtRequestPowerStateChange(this._amt);
    }

    getAmtUrl() {
        return this._amtUrl;
    }

    async getVersion() {
        const softwares = await this._enum("CIM_SoftwareIdentity", 0, 0);
        const version = softwares.find(software => software.InstanceID == "AMT FW Core Version");
        return version.VersionString;
    }

    async getTime() {
        const response = await this._exec("AMT_TimeSynchronizationService", "GetLowAccuracyTimeSynch", {});
        // console.log("XXX AMT_TimeSynchronizationService.GetLowAccuracyTimeSynch response", JSON.stringify(response, null, ' '));
        return new Date(response.Ta0 * 1000);
    }

    async getSystemId() {
        const response = await this._get("CIM_ComputerSystemPackage", 0, 0);
        // console.log("XXX CIM_ComputerSystemPackage response", JSON.stringify(response, null, ' '));
        return guidToString(response.PlatformGUID.toLowerCase());
    }

    async getBiosInfo() {
        const response = await this._get("CIM_BIOSElement", 0, 0);
        // console.log("XXX CIM_BIOSElement response", JSON.stringify(response, null, ' '));
        return `${response.Manufacturer} ${response.Version} ${response.ReleaseDate.Datetime}`;
    }

    async getChassisInfo() {
        const response = await this._get("CIM_Chassis", 0, 0);
        // console.log("XXX CIM_Chassis response", JSON.stringify(response, null, ' '));
        return `${response.Manufacturer} ${response.Model} ${response.Version} ${response.SerialNumber} ${response.Tag}`;
    }

    async getMotherboardInfo() {
        const response = await this._get("CIM_Card", 0, 0);
        // console.log("XXX CIM_Card response", JSON.stringify(response, null, ' '));
        return `${response.Manufacturer} ${response.Model} ${response.Version} ${response.SerialNumber} ${response.Tag}`;
    }

    async getProcessorInfo() {
        // NB you also have CIM_Processor but that does not seem to be useful.
        const response = await this._get("CIM_Chip", 0, 0);
        // console.log("XXX CIM_Chip response", JSON.stringify(response, null, ' '));
        return `${response.Manufacturer} ${response.Version}`;
    }

    async getProvisioningInfo() {
        const response = await this._get("AMT_SetupAndConfigurationService", 0, 0);
        // console.log("XXX AMT_SetupAndConfigurationService response", JSON.stringify(response, null, ' '));
        const provisioningModes = [
            null,                   // #0
            "Admin Control Mode",   // #1
            null,                   // #2
            "Client Control Mode",  // #3
            null                    // #4
        ];
        const provisioningStates = [
            "Pre",  // #0
            "In",   // #1
            "Post", // #2
        ];
        return `${provisioningStates[response.ProvisioningState]} ${provisioningModes[response.ProvisioningMode]}`;
    }

    async getPowerState() {
        const response = await this._get("CIM_AssociatedPowerManagementService", 0, 1);
        // console.log("XXX CIM_AssociatedPowerManagementService response", JSON.stringify(response, null, ' '));
        return response.PowerState;
    }

    async getAvailablePowerStates() {
        const response = await this._get("CIM_AssociatedPowerManagementService", 0, 1);
        var availablePowerStates = response.AvailableRequestedPowerStates;
        if (Number.isInteger(availablePowerStates)) {
            return [availablePowerStates];
        }
        return availablePowerStates;
    }

    async setPowerState(powerStateId) {
        const response = await this._requestPowerStateChange(powerStateId);
        if (response.ReturnValue != 0) {
            throw new Error("Failed to set power state to " + getDmtfPowerStateString(powerStateId) + " (" + JSON.stringify(response) + ")")
        }
    }
}

async function main() {
    const amt = new Amt(settings);

    var systemId = await amt.getSystemId();
    var time = await amt.getTime();
    var version = await amt.getVersion();
    var provisioningInfo = await amt.getProvisioningInfo();
    var bios = await amt.getBiosInfo();
    var chassis = await amt.getChassisInfo();
    var motherboard = await amt.getMotherboardInfo();
    var processor = await amt.getProcessorInfo();
    var powerState = await amt.getPowerState();
    var availablePowerStates = await amt.getAvailablePowerStates();

    console.log("amtUrl:", amt.getAmtUrl());
    console.log("systemId:", systemId);
    console.log("time:", time);
    console.log("version:", version);
    console.log("provisioningInfo:", provisioningInfo);
    console.log("bios:", bios);
    console.log("chassis:", chassis);
    console.log("motherboard:", motherboard);
    console.log("processor:", processor);
    console.log("powerState:", getDmtfPowerStateString(powerState));
    console.log("availablePowerStates:", availablePowerStates.map(getDmtfPowerStateString));

    // TODO is there a way to get the current power uptime? that is, the number of seconds since the last power state change?

    const togglePower = true;

    if (togglePower) {
        var togglePowerState;
        var desiredPowerState;

        // toggle the power state.
        // NB setPowerState can set a powerState that is in availablePowerStates array.
        // NB DmtfPowerStateOffSoft will abruptly power down the system.
        // NB DmtfPowerStateOffSoftGraceful will gracefully power down the system.
        //    NB You must have Intel LMS (Local Manageability Service) running in the OS.
        //       See https://github.com/intel/lms
        // NB A linux based system was gracefully shutdown when the `last` command
        //    does not contain a `crash` entry.
        if (powerState == DmtfPowerStateOn) {
            // try to power off gracefully if available, otherwise, just power it off abruptly.
            // NB To power off gracefully the system should have the LMS running in the OS.
            // NB After a power off, you should wait for a bit, until the LMS starts running,
            //    or else, the system will be powered off abruptly. The MeshCommander UI will
            //    just make the user wait for 30s or so before allowing the user to continue.
            //    So, this means, we should check the system power up time, and only after
            //    X minutes of being powered on, we would allow/consider abruptly powering
            //    off the system.
            //    TODO see which API returns how long the system has power.
            // NB A graceful stop is normally delayed by LMS, that is, LMS schedules a
            //    shutdown to happen in the near future (1m).
            //    TODO see how can we configure that behavior.
            //    In my case, this was seen with journalctl:
            //          Broadcast message from root@vagrant (Tue 2020-08-18 22:00:40 WEST):
            //          The remote administrator has initiated a shutdown on this computer...
            //          The system is going down for poweroff at Tue 2020-08-18 22:01:40 WEST!
            //          ago 18 22:00:40 vagrant systemd-logind[574]: Creating /run/nologin, blocking further logins...
            //          ago 18 22:00:40 vagrant LMS[568]: Remote administrator shutdown request was executed
            // NB when we request a DmtfPowerStateOffSoftGraceful transition, AMT will actually report
            //    DmtfPowerStateOffSoft when its done.
            togglePowerState = availablePowerStates.includes(DmtfPowerStateOffSoftGraceful) 
                && DmtfPowerStateOffSoftGraceful
                || DmtfPowerStateOffSoft;
            desiredPowerState = DmtfPowerStateOffSoft;
        } else {
            togglePowerState = DmtfPowerStateOn;
            desiredPowerState = DmtfPowerStateOn;
        }

        // bail when the desired state is not available.
        // NB off states are not available when KVM or IDER are active.
        if (!availablePowerStates.includes(togglePowerState)) {
            throw new Error(`The desired power state ${getDmtfPowerStateString(togglePowerState)} is not currently available. Only these are: ${JSON.stringify(availablePowerStates.map(getDmtfPowerStateString))}.`);
        }

        // toggle to the desired power state.
        console.log(`Toggling the power state from ${getDmtfPowerStateString(powerState)} to ${getDmtfPowerStateString(togglePowerState)}...`);
        await amt.setPowerState(togglePowerState);

        // wait for the desired power state.
        for (var lastPowerState = null; ; ) {
            var powerState = await amt.getPowerState();
            if (powerState == desiredPowerState) {
                console.log(`The power state is now ${getDmtfPowerStateString(powerState)}.`);
                break;
            }
            if (powerState != lastPowerState) {
                console.log(`Waiting for the power state to change from ${getDmtfPowerStateString(powerState)} to ${getDmtfPowerStateString(desiredPowerState)}...`);
                lastPowerState = powerState;
            }
            await sleep(1000);
        }
    }
}

await main();

process.exit(0);
