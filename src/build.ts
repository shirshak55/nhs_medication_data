import { mkdir, readFile } from "fs/promises"
import { join } from "path"

// Docs: https://bun.com/docs/bundler/executables

type Target = `${"bun"}-${"darwin" | "linux" | "windows"}-${"x64" | "arm64"}`

const ALL_TARGETS: Target[] = [
    "bun-darwin-arm64",
    "bun-darwin-x64",
    "bun-linux-arm64",
    "bun-linux-x64",
    "bun-windows-x64",
]

async function build() {
    const entry = "src/main.ts"
    const outDir = "build"

    const pkgJson = JSON.parse(await readFile("package.json", "utf8")) as {
        name?: string
    }
    const rawName = pkgJson.name

    await mkdir(outDir, { recursive: true })

    for (const target of ALL_TARGETS) {
        const [, os, arch] = target.split("-")
        const suffix = os === "windows" ? ".exe" : ""
        const outPath = join(outDir, `${rawName}-${os}-${arch}${suffix}`)
        console.log(`\nBuilding ${target} -> ${outPath}`)

        const proc = Bun.spawn(
            [
                "bun",
                "build",
                entry,
                "--compile",
                "--outfile",
                outPath,
                "--target",
                target,
                "--external",
                "electron",
                "--external",
                "chromium-bidi",
            ],
            {
                stdio: ["inherit", "inherit", "inherit"],
            },
        )

        await proc.exited
        if (proc.exitCode !== 0) {
            throw new Error(
                `bun build --compile failed for ${target} with code ${proc.exitCode}`,
            )
        }
        console.log(`✔ Executable created at ${outPath}`)
    }
}

build().catch((err) => {
    console.error(err)
    process.exit(1)
})
