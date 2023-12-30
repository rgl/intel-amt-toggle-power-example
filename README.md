This is an example that toggles the power of a remote system using the [intel amt](https://en.wikipedia.org/wiki/Intel_Active_Management_Technology) remote api.

This uses the [Ylianst/MeshCentral amt library](https://github.com/Ylianst/MeshCentral/tree/master/amt) to communicate with the remote system.

# Usage

Provision AMT as described in [rgl/intel-amt-notes](https://github.com/rgl/intel-amt-notes).

**NB** To be able to do a Graceful Shutdown/Reboot you must have the [Intel LMS (Local Manageability Service)](https://github.com/intel/lms) running in the OS.

Install [Node.js 20.10](https://nodejs.org/).

Install the required dependencies:

```bash
npm ci
```

Edit the `intel-amt-toggle-power-example.js` file and modify the
`settings` object with your remote system details.

Execute the example, it will toggle the power of the system:

```bash
node intel-amt-toggle-power-example.js
```

You can also execute [Ylianst/MeshCommander](https://github.com/Ylianst/MeshCommander) to
easily interact with the remote system:

```bash
npx meshcommander
```

Then access it at http://127.0.0.1:3000.
