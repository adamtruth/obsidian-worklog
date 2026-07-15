import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
  TFolder,
  AbstractInputSuggest,
} from "obsidian";

// Day labels indexed Monday=0 through Sunday=6
const DAY_LABELS: readonly string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Placeholders available in the title template
const TITLE_PLACEHOLDERS: readonly [string, string][] = [
  ["{{date}}", "Today's date (YYYY-MM-DD)"],
  ["{{week_number}}", "ISO week number (e.g. Week 29)"],
  ["{{week_start}}", "Start of week in your chosen date format"],
  ["{{week_end}}", "End of week in your chosen date format"],
  ["{{week_start_iso}}", "YYYY-MM-DD of Monday"],
  ["{{week_end_iso}}", "YYYY-MM-DD of Sunday"],
];

interface WorklogSettings {
  folder: string;
  indexNotePath: string;
  titleTemplate: string;
  // Format tokens: MM = month, DD = day, YYYY = year (e.g. "MM/DD/YYYY")
  dateFormat: string;
  // Which days to include as sections in the note (0=Mon, 6=Sun)
  includedDays: number[];
}

const DEFAULT_SETTINGS: WorklogSettings = {
  folder: "Worklog",
  indexNotePath: "Worklogs.md",
  titleTemplate: "Week {{week_number}}: ({{week_start}} - {{week_end}})",
  dateFormat: "M/D",
  includedDays: [0, 1, 2, 3, 4, 5, 6],
};

// Autocomplete for folder paths
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }
  getSuggestions(query: string): TFolder[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder)
      .filter((f) => f.path.toLowerCase().includes(lower))
      .slice(0, 20);
  }
  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }
  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.close();
  }
}

// Autocomplete for markdown file paths
class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }
  getSuggestions(query: string): TFile[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.toLowerCase().includes(lower))
      .slice(0, 20);
  }
  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }
  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    this.close();
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");

// Returns the Monday of the week containing the given date
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Formats a date using user-defined tokens (YYYY, MM, DD, M, D)
function formatDate(d: Date, format: string): string {
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/M/g, String(d.getMonth() + 1))
    .replace(/D/g, String(d.getDate()));
}

// Formats a date as MM-DD (used for file naming only)
function fmtDash(d: Date): string {
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Formats a date as YYYY-MM-DD (used for ISO placeholders)
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Returns the ISO week number for a given date
function getISOWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const jan4 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

// Resolves all placeholders in the user's title template
function resolveTitle(template: string, monday: Date, sunday: Date, dateFormat: string): string {
  const today = new Date();
  return template
    .replace(/{{date}}/g, fmtISO(today))
    .replace(/{{week_number}}/g, String(getISOWeekNumber(monday)))
    .replace(/{{week_start}}/g, formatDate(monday, dateFormat))
    .replace(/{{week_end}}/g, formatDate(sunday, dateFormat))
    .replace(/{{week_start_iso}}/g, fmtISO(monday))
    .replace(/{{week_end_iso}}/g, fmtISO(sunday));
}

export default class WorklogPlugin extends Plugin {
  settings: WorklogSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "create-worklog",
      name: "Worklog note for the current week",
      callback: () => this.createWorklog(),
    });

    this.addSettingTab(new WorklogSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async createWorklog(): Promise<void> {
    const today = new Date();
    const monday = getMondayOfWeek(today);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dateFormat = this.settings.dateFormat || DEFAULT_SETTINGS.dateFormat;
    const title = resolveTitle(this.settings.titleTemplate || DEFAULT_SETTINGS.titleTemplate, monday, sunday, dateFormat);
    const weekNum = pad(getISOWeekNumber(monday));
    const fileName = `${monday.getFullYear()}_W${weekNum}.md`;
    const folder = this.settings.folder.trim();
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Build the note with a heading per selected day
    let content = `# ${title}\n---\n`;
    for (let i = 0; i <= 6; i++) {
      if (!this.settings.includedDays.includes(i)) continue;
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      content += `## ${DAY_LABELS[i]} ${formatDate(day, dateFormat)}\n\n`;
    }

    // Create the folder if it doesn't exist yet
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }

    // Open the note if it already exists, otherwise create it
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      new Notice(`Worklog already exists: ${fileName}`);
      await this.app.workspace.getLeaf().openFile(existing as TFile);
      return;
    }

    const newFile = await this.app.vault.create(filePath, content);
    new Notice(`Created: ${fileName}`);
    await this.app.workspace.getLeaf().openFile(newFile);
    await this.appendToIndex(title, fileName, folder, monday);
  }

  private async appendToIndex(title: string, fileName: string, folder: string, monday: Date): Promise<void> {
    const baseName = fileName.replace(/\.md$/, "");
    const linkTarget = folder ? `${folder}/${baseName}` : baseName;
    const linkLine = `- [[${linkTarget}|${title}]]`;

    // Build the month heading for this entry (e.g. "## July 2026")
    const monthLabel = monday.toLocaleString("en-US", { month: "long" }) + " " + monday.getFullYear();
    const monthHeading = `## ${monthLabel}`;

    const indexPath = this.settings.indexNotePath.trim();
    const indexFile = this.app.vault.getAbstractFileByPath(indexPath);

    if (!indexFile) {
      // Create a fresh index with the first month section
      const content = `# Worklog Index\n---\n${monthHeading}\n${linkLine}\n`;
      await this.app.vault.create(indexPath, content);
      new Notice(`Created index: ${indexPath}`);
      return;
    }

    const current = await this.app.vault.read(indexFile as TFile);

    if (current.includes(linkTarget)) {
      new Notice("Link already present in index.");
      return;
    }

    const sectionIdx = current.indexOf(monthHeading);

    if (sectionIdx !== -1) {
      // Month section exists — insert before the next --- separator
      const afterHeading = current.indexOf("\n", sectionIdx) + 1;
      const nextSep = current.indexOf("\n---", afterHeading);
      if (nextSep !== -1) {
        const updated = current.slice(0, nextSep) + "\n" + linkLine + current.slice(nextSep);
        await this.app.vault.modify(indexFile as TFile, updated);
      } else {
        // This is the last section with no trailing separator
        await this.app.vault.modify(indexFile as TFile, current.trimEnd() + "\n" + linkLine + "\n");
      }
    } else {
      // New month — append a new section at the end
      await this.app.vault.modify(
        indexFile as TFile,
        current.trimEnd() + "\n---\n" + monthHeading + "\n" + linkLine + "\n"
      );
    }

    new Notice(`Link added to ${indexPath}`);
  }
}

class WorklogSettingTab extends PluginSettingTab {
  plugin: WorklogPlugin;

  constructor(app: App, plugin: WorklogPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Worklog Settings" });

    new Setting(containerEl)
      .setName("Worklog folder")
      .setDesc("New worklog notes are created here. Leave blank for vault root.")
      .addSearch((search) => {
        search.setPlaceholder("e.g. Worklog").setValue(this.plugin.settings.folder);
        new FolderSuggest(this.app, search.inputEl);
        search.onChange(async (value) => {
          this.plugin.settings.folder = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Index note")
      .setDesc("(Optional) Note containing linked Worklog notes. Will be created if it does not exist.")
      .addSearch((search) => {
        search.setPlaceholder("e.g. Worklogs.md").setValue(this.plugin.settings.indexNotePath);
        new FileSuggest(this.app, search.inputEl);
        search.onChange(async (value) => {
          this.plugin.settings.indexNotePath = value.trim();
          await this.plugin.saveSettings();
        });
      });


    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Format for dates in the title and day headings.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
          .setValue(this.plugin.settings.dateFormat);
        text.onChange(async (value) => {
          this.plugin.settings.dateFormat = value || DEFAULT_SETTINGS.dateFormat;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Worklog note title")
      .setDesc("Title as the H1 heading in each worklog note. Supports placeholders below.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.titleTemplate)
          .setValue(this.plugin.settings.titleTemplate);
        text.onChange(async (value) => {
          this.plugin.settings.titleTemplate = value || DEFAULT_SETTINGS.titleTemplate;
          await this.plugin.saveSettings();
        });
      });

    // Placeholder reference table for the title template
    containerEl.createEl("h2", { text: "Title placeholders" });
    containerEl.createEl("p", {
      text: "Can be used in the note title template.",
      cls: "setting-item-description",
    });

    const table = containerEl.createEl("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-size:0.85em;";

    for (const [token, desc] of TITLE_PLACEHOLDERS) {
      const tr = table.createEl("tr");
      const tdToken = tr.createEl("td", { text: token });
      tdToken.style.cssText = "font-family:monospace; padding:3px 12px 3px 0; white-space:nowrap;";
      tr.createEl("td", { text: desc }).style.cssText = "color: var(--text-muted); padding:3px 0;";
    }
    // Day selection toggles
    containerEl.createEl("h2", { text: "Days to include" });
    containerEl.createEl("p", {
      text: "Choose which days appear as sections in the worklog note.",
      cls: "setting-item-description",
    });

    DAY_LABELS.forEach((label, i) => {
      new Setting(containerEl)
        .setName(label)
        .addToggle((toggle) => {
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
}
