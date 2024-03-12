const config = {
    get minimumDesktops() {
        return readConfig("minimumDesktops", 2);
    },

    get labelTemplate() {
        return readConfig("labelTemplate", "Desktop %n");
    },
};

function includeWindow(window) {
    // TODO: Any other condition to exclude windows?
    return !window.skipPager;
}

function getOccupiedDesktops() {
    const desktops = new Set();
    workspace.windowList().filter(includeWindow).forEach((w) =>
        w.desktops.forEach((d) => desktops.add(d.x11DesktopNumber))
    );
    return desktops;
}

// TODO: Maybe decompose into multiple functions.
function updateDesktops() {
    const occupiedDesktops = getOccupiedDesktops();
    const maxDesktop = Math.max(...occupiedDesktops);
    // We also do not want to remove the desktop we are currently on
    occupiedDesktops.add(workspace.currentDesktop.x11DesktopNumber);

    // Remove all unoccupied desktops in between occupied ones
    const removedDesktops = workspace.desktops.slice(0, maxDesktop)
        .filter((d) => !occupiedDesktops.has(d.x11DesktopNumber))
        .map((d) => workspace.removeDesktop(d))
        .length;

    // We need at least one desktop to the right
    const neededDesktops = Math.max(
        config.minimumDesktops,
        maxDesktop - removedDesktops + 1,
    );

    // Remove all unneeded desktops from the right of the maximum needed desktop
    workspace.desktops.slice(neededDesktops).forEach((d) =>
        workspace.removeDesktop(d)
    );

    // Create needed desktops to the right
    for (let i = workspace.desktops.length; i < neededDesktops; i++) {
        workspace.createDesktop(i, "Desktop");
    }

    // Relabel all desktops
    const labelTemplate = config.labelTemplate;
    workspace.desktops.forEach((d) =>
        d.name = labelTemplate.replace(/%n/, `${d.x11DesktopNumber}`)
    );
}

var instanceLock = false;

// Using a lock avoids recursing this script when desktops change as a result of this script
function withInstanceLock(locked) {
    if (instanceLock) {
        return;
    }

    instanceLock = true;
    try {
        locked();
    } finally {
        instanceLock = false;
    }
}

workspace.windowAdded.connect(() => withInstanceLock(updateDesktops));
workspace.windowRemoved.connect(() => withInstanceLock(updateDesktops));
workspace.currentDesktopChanged.connect(() => withInstanceLock(updateDesktops));
workspace.desktopsChanged.connect(() => withInstanceLock(updateDesktops));
