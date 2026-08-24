#!/usr/bin/env bash
# git 워크트리 생성·조회·제거·정리 헬퍼.
# 워크트리는 리포지토리 밖 형제 디렉터리에 만든다. 안에 두면
# git status 와 test/*.js 글롭이 워크트리를 함께 훑어 결과가 오염된다.
set -euo pipefail

readonly WORKTREE_DIR_SUFFIX="-worktrees"
readonly BRANCH_NAME_PATTERN='^[A-Za-z0-9][A-Za-z0-9._/-]*$'
readonly FALLBACK_BASE_CANDIDATES=("main" "master")

REPO_ROOT=""
REPO_NAME=""
WORKTREE_ROOT=""

die() {
  printf '오류: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
사용법: scripts/worktree.sh <명령> [인자]

  new <브랜치> [기준]   워크트리 생성. 브랜치가 없으면 기준에서 새로 만든다
                        (기준 기본값: origin/HEAD → main → master → HEAD)
  list                  워크트리 목록
  rm <브랜치> [--force] 워크트리 제거 (커밋 안 된 변경이 있으면 git 이 막는다)
  clean                 사라진 워크트리 메타데이터 정리 + 병합된 워크트리 안내

npm 으로도 호출된다: npm run wt:new feat/export-csv
USAGE
}

# 워크트리 안에서 실행해도 항상 메인 체크아웃을 기준점으로 잡는다.
resolve_paths() {
  local common
  common=$(git rev-parse --git-common-dir 2>/dev/null) \
    || die "git 리포지토리가 아닙니다."
  [[ "$common" == /* ]] || common="$PWD/$common"
  REPO_ROOT=$(cd "$common/.." && pwd) \
    || die "메인 체크아웃 경로를 찾을 수 없습니다."
  REPO_NAME=$(basename "$REPO_ROOT")
  WORKTREE_ROOT="$(dirname "$REPO_ROOT")/${REPO_NAME}${WORKTREE_DIR_SUFFIX}"
}

validate_branch() {
  local branch="$1"
  [[ "$branch" =~ $BRANCH_NAME_PATTERN ]] \
    || die "브랜치 이름에 쓸 수 없는 문자가 있습니다: $branch"
  [[ "$branch" != *".."* ]] \
    || die "브랜치 이름에 '..' 를 쓸 수 없습니다: $branch"
  git check-ref-format "refs/heads/$branch" \
    || die "git 이 거부하는 브랜치 이름입니다: $branch"
}

# feat/export-csv → feat-export-csv
slug() {
  printf '%s' "${1//\//-}"
}

worktree_path() {
  printf '%s/%s' "$WORKTREE_ROOT" "$(slug "$1")"
}

default_base() {
  local ref candidate
  if ref=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null); then
    printf '%s' "$ref"
    return
  fi
  for candidate in "${FALLBACK_BASE_CANDIDATES[@]}"; do
    if git show-ref --verify --quiet "refs/heads/$candidate"; then
      printf '%s' "$candidate"
      return
    fi
  done
  printf 'HEAD'
}

cmd_new() {
  local branch="${1:-}" base="${2:-}"
  [[ -n "$branch" ]] || die "브랜치 이름이 필요합니다. 예: npm run wt:new feat/export-csv"
  validate_branch "$branch"

  local dir
  dir=$(worktree_path "$branch")
  [[ ! -e "$dir" ]] || die "이미 있습니다: $dir"

  mkdir -p "$WORKTREE_ROOT"

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    printf '기존 브랜치 %s 체크아웃\n' "$branch"
    git worktree add "$dir" "$branch"
  else
    base="${base:-$(default_base)}"
    git rev-parse --verify --quiet "$base" >/dev/null \
      || die "기준 참조를 찾을 수 없습니다: $base"
    printf '새 브랜치 %s 를 %s 에서 생성\n' "$branch" "$base"
    git worktree add -b "$branch" "$dir" "$base"
  fi

  printf '→ %s\n' "$dir"
}

cmd_list() {
  git worktree list
}

cmd_rm() {
  local branch="${1:-}" force="${2:-}"
  [[ -n "$branch" ]] || die "브랜치 이름이 필요합니다. 예: npm run wt:rm feat/export-csv"
  validate_branch "$branch"

  local dir
  dir=$(worktree_path "$branch")
  [[ -d "$dir" ]] || die "워크트리가 없습니다: $dir"

  if [[ -n "$force" ]]; then
    [[ "$force" == "--force" ]] || die "알 수 없는 옵션: $force"
    git worktree remove --force "$dir"
  else
    git worktree remove "$dir"
  fi
  printf '제거: %s\n' "$dir"
}

# 삭제는 하지 않는다. 정리 대상만 알려주고 판단은 사용자에게 남긴다.
cmd_clean() {
  git worktree prune --verbose

  local base merged=0 path branch
  base=$(default_base)

  while IFS= read -r path; do
    [[ "$path" == "$REPO_ROOT" ]] && continue
    branch=$(git -C "$path" symbolic-ref --quiet --short HEAD 2>/dev/null) || continue
    if git merge-base --is-ancestor "$branch" "$base" 2>/dev/null; then
      if [[ $merged -eq 0 ]]; then
        printf '\n%s 에 병합 완료된 워크트리:\n' "$base"
        merged=1
      fi
      printf '  %-40s %s\n' "$branch" "$path"
    fi
  done < <(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10)}')

  if [[ $merged -eq 1 ]]; then
    printf '\n제거하려면: npm run wt:rm <브랜치>\n'
  else
    printf '병합 완료된 워크트리는 없습니다.\n'
  fi
}

main() {
  local command="${1:-}"
  [[ $# -gt 0 ]] && shift || true

  case "$command" in
    new)   resolve_paths; cmd_new "$@" ;;
    list)  resolve_paths; cmd_list ;;
    rm)    resolve_paths; cmd_rm "$@" ;;
    clean) resolve_paths; cmd_clean ;;
    ""|-h|--help|help) usage ;;
    *)     usage >&2; die "알 수 없는 명령: $command" ;;
  esac
}

main "$@"
