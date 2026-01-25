/**
 * Database seeding script
 * Run with: npm run seed
 */
import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

function resolveSeedsDir(): string {
    // When running via ts-node (your current setup), this usually works:
    const fromHere = join(__dirname, "seeds");
    if (existsSync(fromHere)) return fromHere;

    // Fallback when working directory is project root:
    const fromCwd = join(process.cwd(), "src", "database", "seeds");
    if (existsSync(fromCwd)) return fromCwd;

    // Last resort (dist builds)
    const fromDist = join(process.cwd(), "dist", "database", "seeds");
    return fromDist;
}

async function runSeed() {
    try {
        console.log("🌱 Initializing database connection...");
        await AppDataSource.initialize();
        console.log("✅ Database connected");

        const seedsDir = resolveSeedsDir();
        console.log(`📁 Seeds directory: ${seedsDir}`);

        const seedFiles = readdirSync(seedsDir)
            .filter((f) => f.toLowerCase().endsWith(".sql"))
            .sort(); // ensures 001_... then 002_... etc.

        if (seedFiles.length === 0) {
            console.log("⚠️ No .sql seed files found. Nothing to seed.");
            await AppDataSource.destroy();
            process.exit(0);
        }

        for (const fileName of seedFiles) {
            const seedFilePath = join(seedsDir, fileName);
            console.log(`\n📄 Reading seed file: ${seedFilePath}`);

            const sql = readFileSync(seedFilePath, "utf-8");

            console.log("🔄 Executing seed SQL...");
            await AppDataSource.query(sql);

            console.log(`✅ Executed: ${fileName}`);
        }

        // --- Verify seeded data (songs)
        try {
            const songs = await AppDataSource.query(
                "SELECT id, title, beginner_midi_path FROM songs ORDER BY order_index ASC, id ASC"
            );
            console.log("\n📊 Songs in database:");
            songs.forEach((song: any) => {
                console.log(`  - ID ${song.id}: ${song.title} (beginner MIDI: ${song.beginner_midi_path})`);
            });
        } catch (e) {
            console.log("\nℹ️ Songs table not found or verification query failed (skipping).");
        }

        // --- Verify seeded data (exercises)
        try {
            const exercises = await AppDataSource.query(
                "SELECT id, title, technique, difficulty, duration_minutes, order_index FROM exercises ORDER BY order_index ASC, id ASC"
            );
            console.log("\n📊 Exercises in database:");
            exercises.forEach((ex: any) => {
                console.log(
                    `  - ID ${ex.id}: ${ex.title} [${ex.technique}/${ex.difficulty}] (${ex.duration_minutes ?? "null"} min) order=${ex.order_index}`
                );
            });
        } catch (e) {
            console.log("\nℹ️ Exercises table not found or verification query failed (skipping).");
        }

        console.log("\n✅ Seed complete!");
        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding database:", error);
        try {
            await AppDataSource.destroy();
        } catch {}
        process.exit(1);
    }
}

runSeed();
