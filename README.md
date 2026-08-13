# Deploiement Automatise d'une Application Web de Gestion des Taches

Projet DevOps et Integration Continue — deploiement complet d'une TODO list
(type Trello minimaliste) dans une pile Docker Compose, avec pipeline CI/CD
Jenkins et deploiement Kubernetes (minikube).

## Architecture

```
                        +----------------------+
   HTTP :80             |      nginx/          |    reverse proxy
  --------------------->|   (reverse proxy)    |
                        +----------+-----------+
                                   | proxy_pass http://app:3000
                        +----------v-----------+
                        |       app/           |    Node.js Express (TODO API)
                        |  (image Docker)      |
                        +----------+-----------+
                                   | postgres://todo:todo@database:5432/todo
                        +----------v-----------+
                        |    database/         |    PostgreSQL 16 (volume pgdata)
                        |  (image Docker)      |
                        +----------------------+

   Jenkins (jenkins/) : build/CI - Docker socket + kubectl
     - clone du depot
     - tests unitaires (npm test)
     - build image Docker
     - push DockerHub
     - deploiement sur Kubernetes (manifestes k8s/)
```

Chaque service vit dans son propre dossier avec son propre `Dockerfile`. Le
`docker-compose.yml` joue le role d'Infrastructure as Code local : il provisionne
tous les services, leurs volumes, leurs dependances et leurs ports.

## Arborescence

```
.
├── docker-compose.yml        # IaC : orchestration de toute la pile
├── app/                      # Application Node.js/Express + tests unitaires
│   ├── Dockerfile
│   ├── package.json
│   ├── src/                  # serveur, routes, repository, acces BDD
│   └── test/                 # tests unitaires (node --test)
├── database/                 # PostgreSQL 16 + init SQL (utilisateur/BDD)
├── nginx/                    # reverse proxy
├── jenkins/                  # Jenkins (Docker + kubectl) + plugins + job seed
├── k8s/                      # manifestes Kubernetes (namespace, secret, PV/PVC,
│                            #   postgres, deployment, service NodePort)
├── pipeline/Jenkinsfile      # pipeline CI/CD declaratif
├── scripts/                  # helpers (seed job Jenkins, deploiement k8s)
└── kubeconfig/               # kubeconfig minikube (monte dans Jenkins, hors git)
```

## Pre-requis

- Docker + Docker Compose (plugin `docker compose` ou binaire `docker-compose`)
- Git
- Optionnel : `minikube` + `kubectl` pour le deploiement Kubernetes

## Demarrage rapide

```bash
docker compose up -d --build
```

Une fois la pile demarree :

| Service  | URL                      | Note                              |
|----------|--------------------------|-----------------------------------|
| nginx    | http://localhost         | acces public a l'application      |
| app      | http://localhost:3000    | acces direct a l'API              |
| jenkins  | http://localhost:8080    | mot de passe initial ci-dessous   |

Mot de passe initial Jenkins :

```bash
docker exec todo-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

API (test rapide) :

```bash
curl http://localhost/api/tasks
curl -X POST http://localhost/api/tasks -H 'Content-Type: application/json' -d '{"title":"Premiere tache"}'
```

Arreter la pile : `docker compose down` — pour detruire aussi les volumes :
`docker compose down -v`.

## Pipeline CI/CD (Jenkins)

Le pipeline est defini dans `pipeline/Jenkinsfile` (pipeline as code) :

1. **Tests unitaires** : `npm ci && npm test` (toujours, quelle que soit la branche)
2. **Build image Docker** : `docker build -t <registry>:<BUILD_NUMBER>`
3. **Push DockerHub** : uniquement sur `main`
4. **Deploiement Kubernetes** : uniquement sur `main` — `kubectl apply -f k8s/`
   puis `kubectl set image` sur le deployment `todo-app`.

### Configuration

1. Dans Jenkins : **Manage Jenkins > Credentials**, ajoutez
   - un identifiant **Username with password** nomme `dockerhub-credentials`
     (vos identifiants DockerHub) ;
   - un identifiant **Secret file** pour le kubeconfig si vous ne montez pas
     `./kubeconfig/config` dans le conteneur.
2. Dans `pipeline/Jenkinsfile` et `jenkins/jobs/pipeline-job.xml`, remplacez
   `VOTRE_UTILISATEUR_DOCKERHUB/todo-app` par votre compte DockerHub.
3. Creez le job (pipeline from SCM) :

```bash
./scripts/setup-jenkins-job.sh
```

Ou manuellement : **Nouvel item > Pipeline**, script path `pipeline/Jenkinsfile`,
depot `https://github.com/VOTRE_UTILISATEUR/todo-app.git`, branche `*/main`.

> Variable d'environnement `DOCKER_REGISTRY` : permet de surcharger le registry
> sans modifier le Jenkinsfile.

## Git : branches et pull request simulee

Le depot utilise la structure Git Flow simplifiee : branche `main` (production)
et branche `dev` (integration).

```bash
git checkout -b dev                # travailler sur dev
git checkout -b feature/ma-tache   # branche de fonctionnalite
# ... modifier le code, tester en local ...
git push origin feature/ma-tache

# Pull request simulee (GitHub) :
#   1. Creez une PR "feature/ma-tache -> dev" (ou main)
#   2. Jenkins valide la PR via le pipeline (etape Tests unitaires)
#   3. Apres validation, mergez la PR
git checkout dev && git merge feature/ma-tache
```

Le pipeline Jenkins tourne systematiquement l'etape **Tests unitaires** sur
toute branche/PR : c'est la validation automatique. Les etapes push + deploiement
ne s'executent que sur `main`.

## Deploiement Kubernetes (minikube)

Les manifestes sont dans `k8s/` :

| Fichier                  | Contenu                                             |
|--------------------------|-----------------------------------------------------|
| `01-namespace.yaml`      | namespace `todo`                                    |
| `02-secret.yaml`         | secret `todo-db-secret` (identifiants BDD)          |
| `03-postgres-pv-pvc.yaml`| volume persistant + PVC pour la BDD (hostPath)      |
| `04-postgres.yaml`       | deployment + service PostgreSQL                     |
| `05-app.yaml`            | deployment (2 replicas) + service NodePort :30080   |

Deploiement :

```bash
minikube start --driver=docker
kubectl config view --minify --flatten > kubeconfig/config   # pour Jenkins
docker compose up -d --build jenkins                          # Jenkins voit le cluster

# depuis le pipeline Jenkins (push DockerHub puis apply k8s) ou manuellement :
./scripts/k8s-deploy.sh VOTRE_UTILISATEUR_DOCKERHUB/todo-app:1
```

Acces a l'application dans le cluster :

```bash
minikube service todo-app -n todo
# ou directement
curl $(minikube ip):30080/api/tasks
```

> Le volume persistant utilise `hostPath` : adapte a minikube (nœud unique,
> nœud nomme `minikube`). Pour un cluster multi-nœuds, remplacez par un
> StorageClass de type `local-path`/`standard`.

## Tests

```bash
cd app && npm test          # tests unitaires de l'API (sans BDD, repository memoire)
docker compose config       # validation du compose
```

## Troubleshooting

- **app ne demarre pas / Connection refused a PostgreSQL** : attendez que le
  conteneur `todo-database` soit sain, `docker compose logs database`.
- **Jenkins ne voit pas le daemon Docker** : le socket `/var/run/docker.sock`
  est monte ; sous Docker Desktop / rootless, ajustez les droits.
- **kubectl de Jenkins : connexion refusee** : `kubeconfig/config` absent ou
  perime. Regenerz-le (voir section Kubernetes) puis `docker compose restart jenkins`.
- **Secret dans git** : `kubeconfig/config` et `jenkins_home/` sont ignores par
  Git (`.gitignore`) — ne les committez jamais.

## Evaluation par rapport au cahier des charges

- [x] 1. Infrastructure as Code : `docker-compose.yml` (IaC) + Dockerfile par service
- [x] 2. Application web : Node.js/Express TODO + code source versionne
- [x] 3. Pipeline CI/CD Jenkins : clone, tests, build, push DockerHub, deploy kubectl
- [x] 4. Git : README, .gitignore, arborescence claire, branches `main`/`dev`, PR simulee
- [x] 5. Kubernetes : deployment, service NodePort, volume persistant BDD, secret
