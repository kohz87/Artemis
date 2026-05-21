use crate::ai_agents::AiAgentPermissionMode;
use crate::pi_cli::AgentStreamRequest;
use std::path::Path;
use std::process::Stdio;

pub(crate) fn build_command(
    binary: &Path,
    request: &AgentStreamRequest,
    agent_dir: &Path,
) -> Result<std::process::Command, String> {

    let mut command = crate::hidden_command(binary);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, binary);
    command
        .args(build_args())
        .arg(build_prompt(request))
        .env("PI_CODING_AGENT_DIR", agent_dir)
        .current_dir(&request.vault_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    Ok(command)
}

fn build_args() -> Vec<String> {
    vec![
        "--mode".into(),
        "json".into(),
        "--no-session".into(),
        "--extension".into(),
    ]
}

fn build_prompt(request: &AgentStreamRequest) -> String {
    crate::cli_agent_runtime::build_prompt(&request.message, request.system_prompt.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;
    use std::path::PathBuf;

    fn request() -> AgentStreamRequest {
        AgentStreamRequest {
            message: "Rename the note".into(),
            system_prompt: None,
            vault_path: "/tmp/vault".into(),
            permission_mode: crate::ai_agents::AiAgentPermissionMode::Safe,
        }
    }

    #[test]
        let args = build_args();

        assert_eq!(args[0], "--mode");
        assert_eq!(args[1], "json");
        assert!(args.contains(&"--no-session".to_string()));
        assert!(args.contains(&"--extension".to_string()));
        assert!(!args.contains(&"--no-tools".to_string()));
    }

    #[test]
    fn command_sets_vault_cwd_closed_stdin_and_config_dir() {
        let agent_dir = tempfile::tempdir().unwrap();
        let command = build_command(&PathBuf::from("pi"), &request(), agent_dir.path()).unwrap();
        let actual_args: Vec<&OsStr> = command.get_args().collect();
        let config_dir = command
            .get_envs()
            .find(|(key, _)| *key == OsStr::new("PI_CODING_AGENT_DIR"))
            .and_then(|(_, value)| value);

        assert_eq!(command.get_program(), OsStr::new("pi"));
        assert_eq!(actual_args[0], OsStr::new("--mode"));
        assert_eq!(actual_args[1], OsStr::new("json"));
        assert_eq!(actual_args.last(), Some(&OsStr::new("Rename the note")));
        assert_eq!(command.get_current_dir(), Some(Path::new("/tmp/vault")));
        assert_eq!(config_dir, Some(agent_dir.path().as_os_str()));
    }

    #[test]
        if let Ok(config) =
        {
            let json: serde_json::Value = serde_json::from_str(&config).unwrap();
            assert_eq!(json["settings"]["toolPrefix"], "none");
            assert_eq!(
                "/tmp/vault"
            );
                .as_str()
                .unwrap()
                .ends_with("index.js"));
        }
    }

    #[test]
        let safe =
            "/tmp/vault",
            crate::ai_agents::AiAgentPermissionMode::PowerUser,
        )
        .unwrap();

        assert_eq!(safe, power);
    }

    #[test]
    fn prompt_keeps_system_prompt_first() {
        let prompt = build_prompt(&AgentStreamRequest {
            system_prompt: Some("Be concise".into()),
            ..request()
        });

        assert!(prompt.starts_with("System instructions:\nBe concise"));
        assert!(prompt.contains("User request:\nRename the note"));
    }
}
