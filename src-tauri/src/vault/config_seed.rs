use std::fs;
use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;

/// Content for `type.md` — describes the generic Type metamodel for the vault.
const TYPE_TYPE_DEFINITION: &str = "\
---
type: Type
order: 0
visible: false
---

# Type

A Type defines shared metadata and defaults for a category of notes in this vault.

## Common properties
- **Icon**: Sidebar icon for this type
- **Color**: Accent color for notes of this type
- **Order**: Sidebar ordering
- **Sidebar label**: Override the default plural label
- **Template**: Default body for new notes of this type
- **View**: Preferred note-list view for this type
";

/// Content for `note.md` — restores the default Note type definition when missing.
const NOTE_TYPE_DEFINITION: &str = "\
---
type: Type
---

# Note

A Note is a general-purpose document — research notes, meeting notes, strategy docs, or anything that doesn't fit a more specific type.
";

/// Write a file if it doesn't exist or is empty (corrupt). Returns true if written.
fn write_if_missing(path: &Path, content: &str) -> Result<bool, String> {
    let needs_write = !path.exists() || fs::metadata(path).map_or(true, |m| m.len() == 0);
    if needs_write {
        fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    }
    Ok(needs_write)
}

fn cleanup_empty_config_dir(vault: &Path) -> Result<bool, String> {
    let config_dir = vault.join("config");
    if !config_dir.is_dir() {
        return Ok(false);
    }

    let is_empty = fs::read_dir(&config_dir)
        .map_err(|e| format!("Failed to inspect {}: {e}", config_dir.display()))?
        .next()
        .is_none();
    if !is_empty {
        return Ok(false);
    }

    fs::remove_dir(&config_dir)
        .map_err(|e| format!("Failed to remove {}: {e}", config_dir.display()))?;
    Ok(true)
}

fn remove_legacy_agents_file(vault: &Path) -> Result<bool, String> {
    let config_agents = vault.join("config").join("agents.md");
    if !config_agents.exists() {
        return Ok(false);
    }

    fs::remove_file(&config_agents)
        .map_err(|e| format!("Failed to remove config/agents.md: {e}"))?;
    Ok(true)
}

/// Seeds Artemis-managed root type definitions used by repair/bootstrap flows.
pub fn seed_config_files(vault_path: impl AsRef<str>) {
    let vault_path = Path::new(vault_path.as_ref());
    ensure_root_type_definitions(vault_path);
}

fn ensure_root_type_definition(vault_path: &Path, file_name: &str, content: &str) {
    let path = vault_path.join(file_name);
    let _ = write_if_missing(&path, content);
}

/// Ensure the default root type definitions exist for opened/repaired vaults.
fn ensure_root_type_definitions(vault_path: &Path) {
    ensure_root_type_definition(vault_path, "type.md", TYPE_TYPE_DEFINITION);
    ensure_root_type_definition(vault_path, "note.md", NOTE_TYPE_DEFINITION);
}

/// Remove legacy `config/agents.md` and clean up an empty `config/` directory.
pub fn migrate_agents_md(vault_path: impl AsRef<str>) {
    let vault = Path::new(vault_path.as_ref());

    if remove_legacy_agents_file(vault).unwrap_or(false) {
        log::info!("Removed legacy config/agents.md");
    }

    if cleanup_empty_config_dir(vault).unwrap_or(false) {
        log::info!("Removed empty config/ directory");
    }
}

/// Repair config files: ensure root type definitions and remove obsolete legacy agent config.
pub fn repair_config_files(vault_path: impl AsRef<str>) -> Result<String, String> {
    let vault = Path::new(vault_path.as_ref());

    let _ = remove_legacy_agents_file(vault)?;
    let _ = cleanup_empty_config_dir(vault)?;

    write_if_missing(&vault.join("type.md"), TYPE_TYPE_DEFINITION)?;
    write_if_missing(&vault.join("note.md"), NOTE_TYPE_DEFINITION)?;

    Ok("Config files repaired".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_vault() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        (dir, vault)
    }

    fn config_dir(vault: &Path) -> PathBuf {
        let dir = vault.join("config");
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_legacy_agents(vault: &Path, content: &str) {
        fs::write(config_dir(vault).join("agents.md"), content).unwrap();
    }

    #[test]
    fn seed_config_files_creates_type_scaffolding_only() {
        let (_dir, vault) = create_vault();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("type.md").exists());
        assert!(vault.join("note.md").exists());
        assert!(!vault.join("AGENTS.md").exists());
        assert!(!vault.join("CLAUDE.md").exists());
        assert!(!vault.join("GEMINI.md").exists());
    }

    #[test]
    fn repair_config_files_removes_legacy_agents_and_keeps_type_scaffolding() {
        let (_dir, vault) = create_vault();
        write_legacy_agents(&vault, "legacy agent guidance");

        let result = repair_config_files(vault.to_str().unwrap()).unwrap();

        assert_eq!(result, "Config files repaired");
        assert!(vault.join("type.md").exists());
        assert!(vault.join("note.md").exists());
        assert!(!vault.join("config").exists());
        assert!(!vault.join("AGENTS.md").exists());
    }

    #[test]
    fn migrate_agents_md_removes_legacy_file_without_creating_ai_guidance() {
        let (_dir, vault) = create_vault();
        write_legacy_agents(&vault, "legacy agent guidance");

        migrate_agents_md(vault.to_str().unwrap());

        assert!(!vault.join("config").exists());
        assert!(!vault.join("AGENTS.md").exists());
    }
}
