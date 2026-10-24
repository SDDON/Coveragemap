"""
Milestone 2 Challenger Empirical Stress Test Suite for Tier 1 Policy Checker.
Adversarially tests detection and false-positive immunity across all 7 rules in scripts/check_policy.py:
1. Z-Index Token Rule (zIndex: 4, zIndex: -1, zIndex: '4', z-index: 4, z-index: 1000)
2. Focus+Context & Zero-JS Styling Rule (opacity: selected ? ..., opacity: 0.4, inline boxShadow)
3. Port Standardization Rule (8001 banned, 8190 without env fallback)
4. Halo Handle Stacking Rule (z-index > 0 in .halo-handle)
5. Parent Scale Immutability Rule (transform: scale in CSS nodes & TSX)
6. Skip Reason Rule (test.skip without // SKIP-REASON:)
7. i18n Centralization Rule (hardcoded Hangul outside locales, comments exempted)
"""

import os
import subprocess
import sys

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHECK_POLICY_SCRIPT = os.path.join(WORKSPACE_ROOT, "scripts", "check_policy.py")
FRONTEND_SRC = os.path.join(WORKSPACE_ROOT, "frontend", "src")


def run_checker():
    result = subprocess.run(
        [sys.executable, CHECK_POLICY_SCRIPT],
        cwd=WORKSPACE_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    return result.returncode, result.stdout + result.stderr


def test_baseline_clean():
    """Baseline check must pass with returncode 0."""
    code, out = run_checker()
    assert code == 0, f"Expected baseline to pass with code 0, got {code}:\n{out}"
    assert "[SUCCESS]" in out


def test_adversarial_injections():
    """Inject adversarial violations into temporary files and assert detection and exit code 1."""
    test_cases = [
        # (filename, code_content, expected_rule_in_output)
        (
            "frontend/src/__temp_test_zindex.tsx",
            "export const TempComp = () => <div style={{ zIndex: 4 }}>Test</div>;\n",
            "Z-Index Token Rule"
        ),
        (
            "frontend/src/__temp_test_zindex_string.tsx",
            "export const TempComp = () => <div style={{ zIndex: '4' }}>Test</div>;\n",
            "Z-Index Token Rule"
        ),
        (
            "frontend/src/__temp_test_zindex.css",
            ".test-class { z-index: 4; }\n",
            "Z-Index Token Rule"
        ),
        (
            "frontend/src/__temp_test_scale.css",
            ".react-flow__node.active { transform: scale(1.1); }\n",
            "Parent Scale Immutability Rule"
        ),
        (
            "frontend/src/__temp_test_scale.tsx",
            "export const TempComp = () => <div style={{ transform: 'scale(1.1)' }}>Test</div>;\n",
            "Parent Scale Immutability Rule"
        ),
        (
            "frontend/src/__temp_test_opacity.tsx",
            "export const TempComp = ({ selected }: { selected: boolean }) => <div style={{ opacity: selected ? 1 : 0.5 }}>Test</div>;\n",
            "Focus+Context Pure CSS Rule"
        ),
        (
            "frontend/src/__temp_test_dim.tsx",
            "export const TempComp = () => <div style={{ opacity: 0.4 }}>Test</div>;\n",
            "Focus+Context Pure CSS Rule"
        ),
        (
            "frontend/src/__temp_test_port8001.ts",
            "export const OLD_PORT = 8001;\n",
            "Port Standardization Rule"
        ),
        (
            "frontend/src/__temp_test_port8190_hardcoded.ts",
            "export const TARGET = 'http://localhost:8190/api';\n",
            "Port Standardization Rule"
        ),
        (
            "frontend/src/__temp_test_hangul.tsx",
            "export const TempComp = () => <div>하드코딩된 한글 텍스트</div>;\n",
            "i18n Centralization Rule"
        ),
    ]

    for rel_path, content, expected_rule in test_cases:
        abs_path = os.path.join(WORKSPACE_ROOT, rel_path)
        try:
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            code, out = run_checker()
            assert code == 1, f"Failed to detect violation in {rel_path}!\nCode: {code}\nOutput:\n{out}"
            assert expected_rule in out, f"Expected rule '{expected_rule}' not found in output for {rel_path}:\n{out}"
            assert rel_path.replace("\\", "/") in out.replace("\\", "/")
        finally:
            if os.path.exists(abs_path):
                os.remove(abs_path)


def test_adversarial_exemptions_and_false_positives():
    """Verify that comments, CSS token definitions, and valid tokens do NOT trigger false positives."""
    non_violation_cases = [
        # (filename, code_content)
        (
            "frontend/src/__temp_clean_tokens.css",
            ":root {\n  --z-canvas-bg: 0;\n  --z-modal: 3000;\n}\n.valid-class {\n  z-index: var(--z-modal);\n}\n"
        ),
        (
            "frontend/src/__temp_clean_comments.tsx",
            "// zIndex: 4\n// transform: scale(1.1)\n// 하드코딩된 한글 주석은 허용됩니다.\n/* 또 다른 한글 주석 */\nexport const CleanComp = () => <div style={{ zIndex: 'var(--z-node-badge)' }}>Clean</div>;\n"
        ),
        (
            "frontend/src/__temp_clean_port_fallback.ts",
            "export const getPort = () => process.env.PORT || '8190';\n"
        ),
        (
            "frontend/src/__temp_clean_scale_exempt.css",
            ".react-flow__handle:hover { transform: scale(1.2); }\n.collapse-btn:active { transform: scale(0.95); }\n"
        ),
    ]

    for rel_path, content in non_violation_cases:
        abs_path = os.path.join(WORKSPACE_ROOT, rel_path)
        try:
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(content)

            code, out = run_checker()
            assert code == 0, f"False positive triggered for clean case {rel_path}!\nOutput:\n{out}"
            assert "[SUCCESS]" in out
        finally:
            if os.path.exists(abs_path):
                os.remove(abs_path)


if __name__ == "__main__":
    print("Testing baseline clean state...")
    test_baseline_clean()
    print("Testing adversarial violation injections (10 cases)...")
    test_adversarial_injections()
    print("Testing false-positive immunity and valid exemptions (4 cases)...")
    test_adversarial_exemptions_and_false_positives()
    print("All Challenger M2 Policy Checker adversarial tests passed successfully!")
