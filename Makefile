.DEFAULT_GOAL := up

PROJECT_NAME := $(shell echo -n $(shell cat package.json|jq -r '.name'))
PROJECT_VERSION := $(shell echo -n $(shell cat package.json|jq -r '.version'))
DOCKER_IMAGE := ${PROJECT_NAME}:${PROJECT_VERSION}

.PHONY: up
up: down
	@docker compose -f ./.docker/docker-compose.yaml up --build -d

.PHONY: down
down:
	@docker compose -f ./.docker/docker-compose.yaml down -v
	@kind delete cluster --name ${PROJECT_NAME}

.PHONY: logs
logs:
	@docker compose -f ./.docker/docker-compose.yaml logs $(watch) -f

.PHONY: kubernetes
kubernetes: down build.debug
	@kind create cluster --name ${PROJECT_NAME}
	@kind load docker-image --name ${PROJECT_NAME} ${DOCKER_IMAGE}.debug
	@kubectl cluster-info --context kind-${PROJECT_NAME}
	@helm repo add bitnami https://charts.bitnami.com/bitnami
	@helm repo add airbyte https://airbytehq.github.io/helm-charts
	@helm repo update
	@kubectl create namespace mongodb
	@kubectl create namespace airbyte
	@helm install --namespace mongodb --values ./.helm/mongodb/values.yaml mongodb bitnami/mongodb --wait-for-jobs
	@helm install --namespace airbyte --values ./.helm/airbyte/values.yaml airbyte airbyte/airbyte --wait-for-jobs
	@make deploy
	
.PHONY: build.debug
build.debug:
	@docker build -f ./.docker/Dockerfile.debug -t ${DOCKER_IMAGE}.debug .

.PHONY: build
build:
	@docker build -f ./.docker/Dockerfile -t ${DOCKER_IMAGE} .

.PHONY: deploy
deploy:
	@rm -rf ./.kubernetes/.applied
	@mkdir -p ./.kubernetes/.applied
	@cp -r ./.kubernetes/* ./.kubernetes/.applied/
	@sed -i -r "s@\\$$\{DOCKER_IMAGE\}@${DOCKER_IMAGE}.debug@g" ./.kubernetes/.applied/app/deployment.yaml
	@kubectl apply -f ./.kubernetes/.applied/app/namespace.yaml
	@kubectl apply -f ./.kubernetes/.applied/app

.PHONY: undeploy
undeploy:
	@kubectl delete -f ./.kubernetes/.applied/app/namespace.yaml

.PHONY: port-forward
port-forward:
	@kubectl cluster-info --context kind-${PROJECT_NAME}
	@kubectl port-forward --context kind-${PROJECT_NAME}
