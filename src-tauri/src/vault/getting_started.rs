use std::path::{Path, PathBuf};

/// Public starter vault cloned when the user chooses Getting Started.
pub const GETTING_STARTED_REPO_URL: &str =
    "https://github.com/refactoringhq/tolaria-getting-started.git";

/// Default location for the Getting Started vault.
pub fn default_vault_path() -> Result<PathBuf, String> {
    dirs::document_dir()
        .map(|d| d.join("Getting Started"))
        .ok_or_else(|| "Could not determine Documents directory".to_string())
}

const GETTING_STARTED_REQUIRED_CONFIG_FILES: [&str; 2] = ["type.md", "note.md"];
const GETTING_STARTED_TEMPLATE_MARKERS: [&str; 2] = ["welcome.md", "views/active-projects.yml"];

/// Check whether a vault path exists on disk.
pub fn vault_exists(path: &str) -> bool {
    let default_path = default_vault_path().ok();
    vault_exists_with_default_path(Path::new(path), default_path.as_deref())
}

fn vault_exists_with_default_path(path: &Path, default_path: Option<&Path>) -> bool {
    if !path.is_dir() {
        return false;
    }

    if !is_canonical_getting_started_path(path, default_path) {
        return true;
    }

    canonical_getting_started_vault_exists(path)
}

fn is_canonical_getting_started_path(path: &Path, default_path: Option<&Path>) -> bool {
    default_path.is_some_and(|candidate| candidate == path)
}

fn canonical_getting_started_vault_exists(path: &Path) -> bool {
    has_getting_started_config_files(path) && has_getting_started_template_marker(path)
}

fn has_getting_started_config_files(path: &Path) -> bool {
    GETTING_STARTED_REQUIRED_CONFIG_FILES
        .iter()
        .all(|file| path.join(file).is_file())
}

fn has_getting_started_template_marker(path: &Path) -> bool {
    GETTING_STARTED_TEMPLATE_MARKERS
        .iter()
        .any(|file| path.join(file).is_file())
}


/// Clone the public starter vault into the requested path.
pub fn create_getting_started_vault(target_path: &str) -> Result<String, String> {
    let vault_path = create_getting_started_vault_from_repo(
        Path::new(target_path),
        &getting_started_repo_url(),
    )?;
    Ok(vault_path.to_string_lossy().to_string())
}

fn create_getting_started_vault_from_repo(
    target_path: &Path,
    repo_url: &str,
) -> Result<PathBuf, String> {
    let target_path_str = target_path.to_string_lossy();
    if target_path_str.trim().is_empty() {
        return Err("Target path is required".to_string());
    }

    crate::git::clone_repo(repo_url, &target_path_str)?;
    let vault_path = canonical_vault_path(target_path)?;
    crate::git::disconnect_all_remotes(path_to_utf8(&vault_path, "Vault path")?)?;
    refresh_cloned_vault_config_files(&vault_path)?;
    Ok(vault_path)
}

fn getting_started_repo_url() -> String {
    std::env::var("TOLARIA_GETTING_STARTED_REPO_URL")
        .or_else(|_| std::env::var("LAPUTA_GETTING_STARTED_REPO_URL"))
        .unwrap_or_else(|_| GETTING_STARTED_REPO_URL.to_string())
}

fn canonical_vault_path(target_path: &Path) -> Result<PathBuf, String> {
    target_path.canonicalize().map_err(|e| {
        format!(
            "Failed to resolve vault path '{}': {}",
            target_path.display(),
            e
        )
    })
}

fn path_to_utf8<'a>(path: &'a Path, context: &str) -> Result<&'a str, String> {
    path.to_str()
        .ok_or_else(|| format!("{context} '{}' is not valid UTF-8", path.display()))
}

fn refresh_cloned_vault_config_files(vault_path: &Path) -> Result<(), String> {
    crate::vault::repair_config_files(path_to_utf8(vault_path, "Vault path")?)?;

    if !vault_has_pending_changes(vault_path)? {
        return Ok(());
    }

    crate::git::ensure_author_config(vault_path)?;
    crate::git::git_commit(
        path_to_utf8(vault_path, "Vault path")?,
        "Initialize Artemis config files",
    )?;
    Ok(())
}

fn vault_has_pending_changes(vault_path: &Path) -> Result<bool, String> {
    let output = crate::hidden_command("git")
        .args(["status", "--porcelain"])
        .current_dir(vault_path)
        .output()
        .map_err(|e| format!("Failed to inspect cloned vault status: {e}"))?;

    if output.status.success() {
        return Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }

    Err(format!(
        "git status failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
        use std::path::Path;
    use std::process::Command as StdCommand;

    fn init_source_repo(path: &Path) {
        fs::create_dir_all(path.join("views")).unwrap();
        fs::write(
            path.join("welcome.md"),
            "# Welcome to Artemis\n\nThis is the starter vault.\n",
        )
        .unwrap();
        fs::write(
            path.join("views").join("active-projects.yml"),
            "title: Active Projects\nfilters: []\n",
        )
        .unwrap();

        StdCommand::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["config", "user.email", "artemis@app.local"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["config", "user.name", "Artemis App"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args(["commit", "-m", "Initial starter vault"])
            .current_dir(path)
            .output()
            .unwrap();
    }

    fn write_tolaria_config_files(path: &Path) {
        fs::create_dir_all(path).unwrap();
        fs::write(path.join("type.md"), "# Type\n").unwrap();
        fs::write(path.join("note.md"), "# Note\n").unwrap();
    }


    #[test]
    fn test_default_vault_path_appends_getting_started() {
        let path = default_vault_path().unwrap();
        let path_str = path.to_string_lossy();
        assert!(path_str.ends_with("Getting Started"));
    }

    #[test]
    fn test_default_getting_started_repo_url_uses_tolaria_slug() {
        assert_eq!(
            GETTING_STARTED_REPO_URL,
            "https://github.com/refactoringhq/tolaria-getting-started.git"
        );
    }

    #[test]
    fn test_canonical_getting_started_path_rejects_plain_tolaria_folder() {
        let dir = tempfile::TempDir::new().unwrap();
        let default_path = dir.path().join("Getting Started");

        write_tolaria_config_files(&default_path);

        assert!(!vault_exists_with_default_path(
            default_path.as_path(),
            Some(default_path.as_path())
        ));
    }

    #[test]
    fn test_non_canonical_vault_path_stays_permissive() {
        let dir = tempfile::TempDir::new().unwrap();
        let default_path = dir.path().join("Getting Started");
        let other_vault_path = dir.path().join("Existing Vault");

        fs::create_dir_all(&other_vault_path).unwrap();

        assert!(vault_exists_with_default_path(
            other_vault_path.as_path(),
            Some(default_path.as_path())
        ));
    }

    #[test]
    fn test_create_getting_started_vault_clones_repo() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);

        let result =
            create_getting_started_vault_from_repo(dest.as_path(), source.to_str().unwrap())
                .unwrap();

        assert_eq!(result, dest.canonicalize().unwrap());
        assert!(dest.join("welcome.md").exists());
        assert!(dest.join("views").join("active-projects.yml").exists());
        assert!(dest.join(".git").exists());
        assert!(!dest.join("AGENTS.md").exists());
        assert!(dest.join("type.md").exists());
        assert!(dest.join("note.md").exists());
    }

    #[test]
    fn test_canonical_getting_started_path_accepts_cloned_starter_vault() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let default_path = dir.path().join("Getting Started");
        init_source_repo(&source);

        create_getting_started_vault_from_repo(default_path.as_path(), source.to_str().unwrap())
            .unwrap();

        assert!(vault_exists_with_default_path(
            default_path.as_path(),
            Some(default_path.as_path())
        ));
    }

    #[test]
    fn test_create_getting_started_vault_rejects_nonempty_destination() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);
        fs::create_dir_all(&dest).unwrap();
        fs::write(dest.join("existing.md"), "# Existing\n").unwrap();

        let err = create_getting_started_vault_from_repo(dest.as_path(), source.to_str().unwrap())
            .unwrap_err();

        assert!(err.contains("already exists and is not empty"));
    }

    #[test]
    fn test_create_getting_started_vault_cleans_partial_clone_on_failure() {
        let dir = tempfile::TempDir::new().unwrap();
        let missing_repo = dir.path().join("missing");
        let dest = dir.path().join("Getting Started");

        let err =
            create_getting_started_vault_from_repo(dest.as_path(), missing_repo.to_str().unwrap())
                .unwrap_err();

        assert!(err.contains("git clone failed"));
        assert!(!dest.exists());
    }

    #[test]
    fn test_create_getting_started_vault_leaves_clean_worktree() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);

        create_getting_started_vault_from_repo(dest.as_path(), source.to_str().unwrap()).unwrap();

        let output = StdCommand::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&dest)
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }

    #[test]
    fn test_create_getting_started_vault_removes_the_starter_remote() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("starter");
        let dest = dir.path().join("Getting Started");
        init_source_repo(&source);

        create_getting_started_vault_from_repo(dest.as_path(), source.to_str().unwrap()).unwrap();

        assert!(!crate::git::has_remote(dest.to_str().unwrap()).unwrap());
    }

}
