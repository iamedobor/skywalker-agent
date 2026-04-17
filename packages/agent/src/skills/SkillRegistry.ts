import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { existsSync } from "fs";
import { glob } from "glob";
import type { BaseSkill } from "./BaseSkill.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SkillRegistry {
  private skills = new Map<string, BaseSkill>();
  private static instance: SkillRegistry | null = null;

  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  async loadAll(skillsDirs?: string[]): Promise<void> {
    const dirs = skillsDirs ?? [
      join(__dirname, "examples"),
      join(process.cwd(), "skills"),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      await this.loadFromDirectory(dir);
    }

    logger.info(`SkillRegistry: ${this.skills.size} skill(s) loaded`);
  }

  private async loadFromDirectory(dir: string): Promise<void> {
    const pattern = join(dir, "**/*.{ts,js}").replace(/\\/g, "/");
    const files = await glob(pattern, { ignore: ["**/*.d.ts", "**/*.map"] });

    for (const file of files) {
      try {
        const url = pathToFileURL(file).href;
        const mod = (await import(url)) as Record<string, unknown>;

        for (const exported of Object.values(mod)) {
          if (
            typeof exported === "function" &&
            exported.prototype instanceof
              (
                await import("./BaseSkill.js")
              ).BaseSkill
          ) {
            const instance = new (exported as new () => BaseSkill)();
            this.register(instance);
          }
        }
      } catch (e) {
        logger.warn(`Failed to load skill from ${file}: ${String(e)}`);
      }
    }
  }

  register(skill: BaseSkill): void {
    if (this.skills.has(skill.metadata.name)) {
      logger.warn(`Skill "${skill.metadata.name}" already registered — overwriting`);
    }
    this.skills.set(skill.metadata.name, skill);
    logger.info(
      `  ✓ Skill loaded: ${skill.metadata.name} — ${skill.metadata.description}`
    );
  }

  get(name: string): BaseSkill | undefined {
    return this.skills.get(name);
  }

  getAll(): BaseSkill[] {
    return Array.from(this.skills.values());
  }

  toJSON(): object[] {
    return this.getAll().map((s) => ({
      name: s.metadata.name,
      description: s.metadata.description,
      version: s.metadata.version,
      author: s.metadata.author,
      triggers: s.metadata.triggers ?? [],
      category: s.metadata.category ?? "general",
      icon: s.metadata.icon ?? "🤖",
      paramsSchema: s.paramsSchema?.() ?? null,
    }));
  }
}
