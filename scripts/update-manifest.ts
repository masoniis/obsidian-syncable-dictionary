const path = "./manifest.json";
const file = Bun.file(path);

const manifest = await file.json();
manifest.version = process.argv[2]; // get version from command line arg

await Bun.write(path, JSON.stringify(manifest, null, "\t"));

export {};
