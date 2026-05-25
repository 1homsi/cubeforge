SHELL := /bin/bash

.PHONY: feat code ship ci-fix status

feat:
	@test -n "$(NAME)" || (echo "Usage: make feat NAME='feature name'" && exit 1)
	@bash scripts/pipeline.sh feat "$(NAME)"

code:
	@test -n "$(NAME)" || (echo "Usage: make code NAME='feature name'" && exit 1)
	@bash scripts/pipeline.sh code "$(NAME)"

ship:
	@test -n "$(NAME)" || (echo "Usage: make ship NAME='feature name'" && exit 1)
	@bash scripts/pipeline.sh ship "$(NAME)"

ci-fix:
	@test -n "$(NAME)" || (echo "Usage: make ci-fix NAME='feature name'" && exit 1)
	@bash scripts/pipeline.sh ci-fix "$(NAME)"

status:
	@test -n "$(NAME)" || (echo "Usage: make status NAME='feature name'" && exit 1)
	@bash scripts/pipeline.sh status "$(NAME)"
