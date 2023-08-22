#!/bin/sh

echo 'Checking if nodejs is installed...'

if [ `node -v | grep -E "v((1[6-9])|([2-9]\d+))\."` != '' ];
then
  echo 'Checking if all dependencies are installed...'
  node scripts/modules_checker_cn.js
  echo 'Starting AWA-Helper...'
  node index.js
  exit 0
else
  echo "\033[31mNot installed\033[0m"
  echo "\033[34mInstalling nodejs...\033[0m"

  if type wget >/dev/null 2>&1;
  then
    wget -O node-v18.12.1-linux-x64.tar.xz -c https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz
  elif type curl >/dev/null 2>&1;
  then
    curl -r 0-100 -o node-v18.12.1-linux-x64.tar.xz https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz
  fi

  if [ -f "node-v18.12.1-linux-x64.tar.xz" ];
  then
    if type tar >/dev/null 2>&1;
    then
      tar xf node-v18.12.1-linux-x64.tar.xz
      cd node-v18.12.1-linux-x64/
      nodePath=$(realpath ./bin/node)
      npmPath=$(realpath ./bin/npm)
      ln -sf $nodePath /usr/bin/node
      ln -sf $npmPath /usr/bin/npm
      cd ..
    else
      echo "\033[31mUnzip Failed: node-v18.12.1-linux-x64.tar.xz\033[0m"
    fi
  else
    echo "\033[31mDownload Failed: https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz\033[0m"
  fi
fi

if [ `node -v | grep -E "v((1[6-9])|([2-9]\d+))\."` != '' ];
then
  echo 'Checking if all dependencies are installed...'
  node scripts/modules_checker_cn.js
  echo 'Starting AWA-Helper...'
  node index.js
else
  if [ `./node-v18.12.1-linux-x64/bin/node -v | grep "v18\."` != '' ];
  then
    echo 'Checking if all dependencies are installed...'
    ./node-v18.12.1-linux-x64/bin/node scripts/modules_checker_cn.js  "./node-v18.12.1-linux-x64/"
    echo 'Starting AWA-Helper...'
    ./node-v18.12.1-linux-x64/bin/node index.js
  else
    echo "\033[31mInstalling Failed\033[0m"
  fi
fi

rm -f node-v18.12.1-linux-x64.tar.xz
