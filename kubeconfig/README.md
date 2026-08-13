Ce dossier contient le fichier `config` utilise par le conteneur Jenkins pour
communiquer avec le cluster Kubernetes (minikube).

Apres avoir demarre minikube sur votre machine hote :

    minikube start --driver=docker
    kubectl config view --minify --flatten > kubeconfig/config

Puis relancez la pile :

    docker compose up -d --build jenkins

ATTENTION : ce fichier contient des identifiants de cluster. Il est exclu du
depot Git (voir .gitignore). Ne jamais le committer.
