#!/usr/bin/env bash
#
# Deploie (ou met a jour) l application sur le cluster Kubernetes
# pointe par KUBECONFIG (minikube par defaut).
#
# Usage :
#   ./scripts/k8s-deploy.sh [IMAGE_TAG]
#   ./scripts/k8s-deploy.sh VOTRE_UTILISATEUR_DOCKERHUB/todo-app:42
#
set -euo pipefail

KUBECTL="kubectl"
IMAGE_TAG="${1:-}"

echo "==> Application des manifestes k8s/"
${KUBECTL} apply -f k8s/ --recursive

if [ -n "${IMAGE_TAG}" ]; then
  echo "==> Mise a jour de l image vers ${IMAGE_TAG}"
  ${KUBECTL} set image deployment/todo-app todo-app="${IMAGE_TAG}" -n todo
  ${KUBECTL} rollout status deployment/todo-app -n todo --timeout=180s
fi

echo "==> Etat du cluster"
${KUBECTL} get pods,svc,pvc -n todo
