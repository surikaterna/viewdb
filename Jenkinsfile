pipeline {
    agent none
    options { skipDefaultCheckout() }
    environment {
        NPM_TOKEN = credentials('80057302-eb65-11e9-aebf-dc7196dad022')
    }

    stages {
        stage('Checkout SCM') {
            agent {
                label 'lynx'
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'rm -Rf .git'
                checkout scm
            }
        }

        stage('Install dependencies') {
            agent {
                docker {
                    image 'node:22-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                echo "installing dependencies for build ${env.BRANCH_NAME}-${env.BUILD_ID}"
                sh 'npm ci'
            }
        }

        stage('Build') {
            agent {
                docker {
                    image 'node:22-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'npm run build'
            }
        }

        stage('Lint') {
            agent {
                docker {
                    image 'node:22-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            agent {
                docker {
                    image 'node:22-bullseye'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'npm run test'
            }
        }

        stage('Audit') {
            agent {
                docker {
                    image 'node:22-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'npm audit --workspaces'
            }
        }

        stage('Publish to npm') {
            agent {
                docker {
                    image 'node:22-alpine'
                    label 'lynx'
                }
            }

            when {
                expression {
                    BRANCH_NAME == 'develop' || BRANCH_NAME ==~ /release\/\d+\.\d+\.\d+/
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
                NPM_TOKEN = credentials('80057302-eb65-11e9-aebf-dc7196dad022')
            }

            steps {
                echo "publishing npm packages for build ${env.BRANCH_NAME}-${env.BUILD_ID}"
                sh "npm set //registry.npmjs.org/:_authToken=${env.NPM_TOKEN}"
                sh 'npm run changeset:publish'
            }
        }
    }
}
