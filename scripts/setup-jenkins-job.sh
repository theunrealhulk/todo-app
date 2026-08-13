#!/usr/bin/env bash
#
# Cree le job Jenkins "todo-app-pipeline" a partir de l XML
# jenkins/jobs/pipeline-job.xml (pipeline defini dans pipeline/Jenkinsfile).
#
# Usage :
#   ./scripts/setup-jenkins-job.sh
#
# Variables d environnement (optionnelles) :
#   JENKINS_URL   defaut http://localhost:8080
#   JENKINS_USER  defaut admin
#   JENKINS_PASS  defaut mot de passe initial lu dans le conteneur
#
set -euo pipefail

JENKINS_URL="${JENKINS_URL:-http://localhost:8080}"
JENKINS_USER="${JENKINS_USER:-admin}"
JENKINS_PASS="${JENKINS_PASS:-$(docker exec todo-jenkins cat /var/jenkins_home/secrets/initialAdminPassword)}"

JOB_XML="jenkins/jobs/pipeline-job.xml"
JOB_NAME="todo-app-pipeline"

if [ ! -f "$JOB_XML" ]; then
  echo "Erreur : $JOB_XML introuvable. Lancez depuis la racine du projet."
  exit 1
fi

echo "Creation du job '${JOB_NAME}' sur ${JENKINS_URL} ..."

curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -u "${JENKINS_USER}:${JENKINS_PASS}" \
  -H "Content-Type: application/xml" \
  --data-binary "@${JOB_XML}" \
  "${JENKINS_URL}/createItem?name=${JOB_NAME}"

echo "Termine. Rendez-vous sur ${JENKINS_URL}/job/${JOB_NAME}"
