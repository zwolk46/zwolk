import { spawn } from "node:child_process";
export async function execLogged(args) {
    const { cmd, argv, cwd, signal, log } = args;
    log(`$ ${cmd} ${argv.map(shellEscapeForLog).join(" ")}`);
    return await new Promise((resolve, reject) => {
        const child = spawn(cmd, argv, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true
        });
        const abort = () => {
            try {
                child.kill("SIGKILL");
            }
            catch {
                // ignore
            }
            reject(new Error("Canceled"));
        };
        if (signal.aborted)
            return abort();
        signal.addEventListener("abort", abort, { once: true });
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (d) => log(String(d).trimEnd()));
        child.stderr.on("data", (d) => log(String(d).trimEnd()));
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
            signal.removeEventListener("abort", abort);
            resolve({ code: code ?? 0 });
        });
    });
}
function shellEscapeForLog(s) {
    if (!s)
        return "''";
    if (/^[a-zA-Z0-9_./:-]+$/.test(s))
        return s;
    return `'${s.replaceAll("'", "'\\''")}'`;
}
