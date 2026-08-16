/**
 * RAB plugin for OpenCode.ai
 *
 * Registers the repository's skills/ directory via the config hook so
 * OpenCode discovers the rab-react, rab-cdp-debug, and rab-rn-debug skills
 * without symlinks or manual config edits.
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rabSkillsDir = path.resolve(__dirname, "../../skills");

export const RabPlugin = async () => {
  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(rabSkillsDir)) {
        config.skills.paths.push(rabSkillsDir);
      }
    },
  };
};
