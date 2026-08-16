# Deploiement Automatise d'une Application Web de Gestion des Taches

Projet DevOps et Integration Continue — deploiement complet d'une TODO list
(type Trello minimaliste) dans une pile Docker Compose, avec pipeline CI/CD
Jenkins et deploiement Kubernetes (minikube).

**Depot :** https://github.com/theunrealhulk/todo-app
**DockerHub :** https://hub.docker.com/r/theunrealhulk/todo-app
**Pipeline :** Build #3 termine avec succes — image `theunrealhulk/todo-app:3`

## Architecture

```
                        +----------------------+
   HTTP :80             |      nginx/          |    reverse proxy
  --------------------->|   (reverse proxy)    |
                        +----------+-----------+
                                   | proxy_pass http://app:3000
                        +----------v-----------+
                        |       app/           |    Node.js Express (TODO API + UI)
                        |  (image Docker)      |
                        +----------+-----------+
                                   | postgres://todo:todo@database:5432/todo
                        +----------v-----------+
                        |    database/         |    PostgreSQL 16 (volume pgdata)
                        |  (image Docker)      |
                        +----------------------+

   Jenkins (jenkins/) : build/CI - Docker socket + kubectl (network_mode: host)
     - clone du depot
     - tests unitaires (npm test)
     - build image Docker
     - push sur DockerHub (theunrealhulk/todo-app:<BUILD_NUMBER>)
     - deploiement sur Kubernetes via kubectl
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
│   ├── src/
│   │   ├── server.js         # point d'entree, connecte la BDD
│   │   ├── app.js            # routes Express (API + UI statique)
│   │   ├── repository.js     # PostgresRepository + MemoryRepository (tests)
│   │   ├── db.js             # pool PostgreSQL
│   │   └── public/index.html # interface web (ajout/suppression de taches)
│   └── test/app.test.js      # 8 tests unitaires (node --test)
├── database/                 # PostgreSQL 16 + init SQL (utilisateur/BDD)
├── nginx/                    # reverse proxy
├── jenkins/                  # Jenkins (Docker CLI + kubectl) + plugins + job seed
├── k8s/                      # manifestes Kubernetes
│   ├── 01-namespace.yaml     # namespace todo
│   ├── 02-secret.yaml        # secret todo-db-secret (identifiants BDD)
│   ├── 03-postgres-pv-pvc.yaml  # volume persistant + PVC (hostPath)
│   ├── 04-postgres.yaml      # deployment + service PostgreSQL
│   └── 05-app.yaml           # deployment (2 replicas) + service NodePort
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

| Service  | URL                      | Note                                   |
|----------|--------------------------|----------------------------------------|
| nginx    | http://localhost         | interface web + API (reverse proxy)    |
| app      | http://localhost:3000    | acces direct a l'API                   |
| jenkins  | http://localhost:8080    | login : admin (voir ci-dessous)        |

Identifiants Jenkins :
- **Utilisateur :** `admin`
- **Mot de passe :** contenu dans `.jenkins-admin-password`

API (test rapide) :

```bash
curl http://localhost/api/tasks
curl -X POST http://localhost/api/tasks -H 'Content-Type: application/json' -d '{"title":"Premiere tache"}'
curl http://localhost/api/tasks/1
curl -X DELETE http://localhost/api/tasks/1
```

Arreter la pile : `docker compose down` — pour detruire aussi les volumes :
`docker compose down -v`.

## Pipeline CI/CD (Jenkins)

Le pipeline est defini dans `pipeline/Jenkinsfile` (pipeline as code) :

1. **Tests unitaires** : `npm ci && npm test` (8 tests)
2. **Build image Docker** : `docker build -t theunrealhulk/todo-app:<BUILD_NUMBER>`
3. **Push DockerHub** : `docker push theunrealhulk/todo-app:<BUILD_NUMBER>`
4. **Deploiement Kubernetes** : `kubectl apply -f k8s/` puis `kubectl set image`

### Configuration

1. Dans Jenkins (**Manage Jenkins > Credentials > System > Global**), creez :
   - **Username with password**, ID : `dockerhub`
     (identifiants DockerHub)
2. Le job pipeline est deja cree : `todo-app-pipeline`
   (SCM : `https://github.com/theunrealhulk/todo-app.git`, branche `*/main`,
   script path : `pipeline/Jenkinsfile`)

Pour recreer le job manuellement :

```bash
JENKINS_PASS=$(cat .jenkins-admin-password) ./scripts/setup-jenkins-job.sh
```

Ou via l'UI : **Nouvel item > Pipeline**, script path `pipeline/Jenkinsfile`,
depot `https://github.com/theunrealhulk/todo-app.git`, branche `*/main`.

## Git : branches et pull request simulee

Le depot utilise la structure Git Flow simplifiee : branche `main` (production)
et branche `dev` (integration).

| Branche               | Dernier commit                          |
|-----------------------|-----------------------------------------|
| `main`                | `fix(pipeline): remove branch when...`  |
| `dev`                 | `fix(pipeline): remove branch when...`  |
| `feature/task-detail` | `feature(task-detail): add GET /api/...`|

Pull request simulee :
1. Branche `feature/task-detail` creee depuis `dev`
2. Ajout de l'endpoint `GET /api/tasks/:id` + tests (8/8 passes)
3. Merge dans `dev`, puis fusion dans `main`
4. Push sur GitHub : https://github.com/theunrealhulk/todo-app

Le pipeline Jenkins valide a chaque execution (tests unitaires). Les etapes
push + deploiement s'executent a chaque build.

## Deploiement Kubernetes (minikube)

Les manifestes sont dans `k8s/` :

| Fichier                    | Contenu                                             |
|----------------------------|-----------------------------------------------------|
| `01-namespace.yaml`        | namespace `todo`                                    |
| `02-secret.yaml`           | secret `todo-db-secret` (identifiants BDD)          |
| `03-postgres-pv-pvc.yaml`  | volume persistant + PVC pour la BDD (hostPath)      |
| `04-postgres.yaml`         | deployment + service PostgreSQL                     |
| `05-app.yaml`              | deployment (2 replicas) + service NodePort :30080   |

Etat verifie du cluster :

```
NAME                        READY   STATUS    RESTARTS
postgres-7cc489f56-8d2jd    1/1     Running   0
todo-app-5b54df6c4d-chkgl   1/1     Running   0
todo-app-5b54df6c4d-v6lb2   1/1     Running   0

SERVICE      TYPE       PORT(S)        AGE
todo-app     NodePort   80:30080/TCP   2d
postgres     ClusterIP  5432/TCP       2d
```

Deploiement manuel :

```bash
minikube start --driver=docker
kubectl config view --minify --flatten > kubeconfig/config
docker compose up -d --build jenkins

# Ou via le script :
./scripts/k8s-deploy.sh theunrealhulk/todo-app:3
```

Acces a l'application dans le cluster :

```bash
curl $(minikube ip):30080/api/tasks
```

> Le volume persistant utilise `hostPath` : adapte a minikube (nœud unique,
> nœud nomme `minikube`). Pour un cluster multi-nœuds, remplacez par un
> StorageClass de type `local-path`/`standard`.

## Tests

```bash
cd app && npm test          # 8 tests unitaires (repository memoire, sans BDD)
docker compose config       # validation du compose
```

Resultat verifie :

```
✔ GET /health returns ok
✔ GET /api/tasks returns an empty list initially
✔ POST /api/tasks creates a task
✔ POST /api/tasks rejects an empty title
✔ GET /api/tasks returns created tasks
✔ GET /api/tasks/:id returns a single task
✔ DELETE /api/tasks/:id removes a task
✔ DELETE /api/tasks/abc rejects an invalid id
tests 8 | pass 8 | fail 0
```

## Troubleshooting

- **app ne demarre pas / Connection refused a PostgreSQL** : attendez que le
  conteneur `todo-database` soit sain, `docker compose logs database`.
- **Jenkins ne voit pas le daemon Docker** : le socket `/var/run/docker.sock`
  est monte ; sous Docker Desktop / rootless, ajustez les droits.
- **kubectl de Jenkins : connexion refusee** : `kubeconfig/config` absent ou
  perime. Regenerz-le (voir section Kubernetes) puis `docker compose restart jenkins`.
- **Jenkins n'arrive pas a minikube** : le service Jenkins utilise
  `network_mode: host` pour atteindre le reseau `192.168.49.x` de minikube.
- **Secret dans git** : `kubeconfig/config` et `jenkins_home/` sont ignores par
  Git (`.gitignore`) — ne les committez jamais.

## Etat final verifie

| Composant        | Etat        | Preuve                                              |
|------------------|-------------|------------------------------------------------------|
| Web UI           | En ligne    | http://localhost (interface de gestion des taches)    |
| API REST         | En ligne    | http://localhost/api/tasks                            |
| Tests unitaires  | 8/8 OK      | `npm test` — tous les tests passent                  |
| Docker Compose   | En ligne    | app, database, nginx, jenkins — tous Up/Healthy       |
| Jenkins          | En ligne    | http://localhost:8080 — Build #3 SUCCESS              |
| DockerHub        | Pousse      | `theunrealhulk/todo-app:3` (push par le pipeline)    |
| K8s deployment   | En ligne    | 2 replicas Running, image `theunrealhulk/todo-app:3` |
| K8s service      | NodePort    | :30080 — repond avec les donnees                     |
| Git              | Pousse      | main, dev, feature/task-detail sur GitHub            |

## Evaluation par rapport au cahier des charges

- [x] 1. Infrastructure as Code : `docker-compose.yml` (IaC) + Dockerfile par service
- [x] 2. Application web : Node.js/Express TODO + interface web + code source versionne
- [x] 3. Pipeline CI/CD Jenkins : clone, tests, build, push DockerHub, deploy kubectl
- [x] 4. Git : README, .gitignore, arborescence claire, branches `main`/`dev`, PR simulee
- [x] 5. Kubernetes : deployment, service NodePort, volume persistant BDD, secret
