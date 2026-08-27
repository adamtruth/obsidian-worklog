var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WeeklogPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
var TITLE_PLACEHOLDERS = [
  ["{{date}}", "Today's date (YYYY-MM-DD)"],
  ["{{week_number}}", "ISO week number (e.g. Week 29)"],
  ["{{week_start}}", "Start of week in your chosen date format"],
  ["{{week_end}}", "End of week in your chosen date format"],
  ["{{week_start_iso}}", "YYYY-MM-DD of Monday"],
  ["{{week_end_iso}}", "YYYY-MM-DD of Sunday"]
];
var DEFAULT_SETTINGS = {
  folder: "Weeklog",
  indexNotePath: "Weeklogs.md",
  titleTemplate: "Week {{week_number}}: ({{week_start}} - {{week_end}})",
  dateFormat: "M/D",
  includedDays: [0, 1, 2, 3, 4, 5, 6]
};
var FolderSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.app.vault.getAllLoadedFiles().filter((f) => f instanceof import_obsidian.TFolder).filter((f) => f.path.toLowerCase().includes(lower)).slice(0, 20);
  }
  renderSuggestion(folder, el) {
    el.setText(folder.path);
  }
  selectSuggestion(folder) {
    this.setValue(folder.path);
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
};
var FileSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.app.vault.getMarkdownFiles().filter((f) => f.path.toLowerCase().includes(lower)).slice(0, 20);
  }
  renderSuggestion(file, el) {
    el.setText(file.path);
  }
  selectSuggestion(file) {
    this.setValue(file.path);
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
};
var pad = (n) => String(n).padStart(2, "0");
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatDate(d, format) {
  return format.replace(/YYYY/g, String(d.getFullYear())).replace(/MM/g, pad(d.getMonth() + 1)).replace(/DD/g, pad(d.getDate())).replace(/M/g, String(d.getMonth() + 1)).replace(/D/g, String(d.getDate()));
}
function fmtISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getISOWeekNumber(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const jan4 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - jan4.getTime()) / 864e5 - 3 + (jan4.getDay() + 6) % 7) / 7);
}
function resolveTitle(template, monday, sunday, dateFormat) {
  const today = /* @__PURE__ */ new Date();
  return template.replace(/{{date}}/g, fmtISO(today)).replace(/{{week_number}}/g, String(getISOWeekNumber(monday))).replace(/{{week_start}}/g, formatDate(monday, dateFormat)).replace(/{{week_end}}/g, formatDate(sunday, dateFormat)).replace(/{{week_start_iso}}/g, fmtISO(monday)).replace(/{{week_end_iso}}/g, fmtISO(sunday));
}
var WeeklogPlugin = class extends import_obsidian.Plugin {
  settings;
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "create-weeklog",
      name: "Weeklog note for the current week",
      callback: () => this.createWeeklog()
    });
    this.addSettingTab(new WeeklogSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  // Creates all folders in a path that don't already exist
  async ensureFolderPath(folderPath) {
    const parts = folderPath.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
  async createWeeklog() {
    const today = /* @__PURE__ */ new Date();
    const monday = getMondayOfWeek(today);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const dateFormat = this.settings.dateFormat || DEFAULT_SETTINGS.dateFormat;
    const title = resolveTitle(this.settings.titleTemplate || DEFAULT_SETTINGS.titleTemplate, monday, sunday, dateFormat);
    const weekNum = pad(getISOWeekNumber(monday));
    const fileName = `${monday.getFullYear()}_W${weekNum}.md`;
    const folder = this.settings.folder.trim().replace(/\/+$/, "");
    const filePath = folder ? `${folder}/${fileName}` : fileName;
    let content = `# ${title}
---
`;
    for (let i = 0; i <= 6; i++) {
      if (!this.settings.includedDays.includes(i)) continue;
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      content += `## ${DAY_LABELS[i]} ${formatDate(day, dateFormat)}

`;
    }
    if (folder) {
      await this.ensureFolderPath(folder);
    }
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      new import_obsidian.Notice(`Weeklog already exists: ${fileName}`);
      await this.app.workspace.getLeaf().openFile(existing);
      return;
    }
    const newFile = await this.app.vault.create(filePath, content);
    new import_obsidian.Notice(`Created: ${fileName}`);
    await this.app.workspace.getLeaf().openFile(newFile);
    await this.appendToIndex(title, fileName, folder, monday);
  }
  async appendToIndex(title, fileName, folder, monday) {
    const baseName = fileName.replace(/\.md$/, "");
    const linkTarget = folder ? `${folder}/${baseName}` : baseName;
    const linkLine = `- [[${linkTarget}|${title}]]`;
    const monthLabel = monday.toLocaleString("en-US", { month: "long" }) + " " + monday.getFullYear();
    const monthHeading = `## ${monthLabel}`;
    const indexPath = this.settings.indexNotePath.trim().replace(/\/+$/, "");
    if (!indexPath || !indexPath.endsWith(".md")) {
      new import_obsidian.Notice("Weeklog: index note path must end with .md \u2014 check plugin settings.");
      return;
    }
    const indexFile = this.app.vault.getAbstractFileByPath(indexPath);
    if (!indexFile) {
      const indexParent = indexPath.includes("/") ? indexPath.substring(0, indexPath.lastIndexOf("/")) : "";
      if (indexParent) {
        await this.ensureFolderPath(indexParent);
      }
      const content = `# Weeklog Index
---
${monthHeading}
${linkLine}
`;
      await this.app.vault.create(indexPath, content);
      new import_obsidian.Notice(`Created index: ${indexPath}`);
      return;
    }
    const current = await this.app.vault.read(indexFile);
    if (current.includes(linkTarget)) {
      new import_obsidian.Notice("Link already present in index.");
      return;
    }
    const sectionIdx = current.indexOf(monthHeading);
    if (sectionIdx !== -1) {
      const afterHeading = current.indexOf("\n", sectionIdx) + 1;
      const nextSep = current.indexOf("\n---", afterHeading);
      if (nextSep !== -1) {
        const updated = current.slice(0, nextSep) + "\n" + linkLine + current.slice(nextSep);
        await this.app.vault.modify(indexFile, updated);
      } else {
        await this.app.vault.modify(indexFile, current.trimEnd() + "\n" + linkLine + "\n");
      }
    } else {
      await this.app.vault.modify(
        indexFile,
        current.trimEnd() + "\n---\n" + monthHeading + "\n" + linkLine + "\n"
      );
    }
    new import_obsidian.Notice(`Link added to ${indexPath}`);
  }
};
var WeeklogSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Weeklog Settings" });
    new import_obsidian.Setting(containerEl).setName("Weeklog folder").setDesc("New weeklog notes are created here. Leave blank for vault root.").addSearch((search) => {
      search.setPlaceholder("e.g. Weeklog").setValue(this.plugin.settings.folder);
      new FolderSuggest(this.app, search.inputEl);
      search.onChange(async (value) => {
        this.plugin.settings.folder = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Index note").setDesc("(Optional) Note containing linked Weeklog notes. Will be created if it does not exist.").addSearch((search) => {
      search.setPlaceholder("e.g. Weeklogs.md").setValue(this.plugin.settings.indexNotePath);
      new FileSuggest(this.app, search.inputEl);
      search.onChange(async (value) => {
        this.plugin.settings.indexNotePath = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Date format").setDesc("Format for dates in the title and day headings.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dateFormat).setValue(this.plugin.settings.dateFormat);
      text.onChange(async (value) => {
        this.plugin.settings.dateFormat = value || DEFAULT_SETTINGS.dateFormat;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Weeklog note title").setDesc("Title as the H1 heading in each weeklog note. Supports placeholders below.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.titleTemplate).setValue(this.plugin.settings.titleTemplate);
      text.onChange(async (value) => {
        this.plugin.settings.titleTemplate = value || DEFAULT_SETTINGS.titleTemplate;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h2", { text: "Title placeholders" });
    containerEl.createEl("p", {
      text: "Can be used in the note title template.",
      cls: "setting-item-description"
    });
    const table = containerEl.createEl("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-size:0.85em;";
    for (const [token, desc] of TITLE_PLACEHOLDERS) {
      const tr = table.createEl("tr");
      const tdToken = tr.createEl("td", { text: token });
      tdToken.style.cssText = "font-family:monospace; padding:3px 12px 3px 0; white-space:nowrap;";
      tr.createEl("td", { text: desc }).style.cssText = "color: var(--text-muted); padding:3px 0;";
    }
    containerEl.createEl("h2", { text: "Days to include" });
    containerEl.createEl("p", {
      text: "Choose which days appear as sections in the weeklog note.",
      cls: "setting-item-description"
    });
    DAY_LABELS.forEach((label, i) => {
      new import_obsidian.Setting(containerEl).setName(label).addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includedDays.includes(i));
        toggle.onChange(async (enabled) => {
          const days = this.plugin.settings.includedDays;
          if (enabled && !days.includes(i)) {
            days.push(i);
            days.sort((a, b) => a - b);
          } else if (!enabled) {
            this.plugin.settings.includedDays = days.filter((d) => d !== i);
          }
          await this.plugin.saveSettings();
        });
      });
    });
  }
};
