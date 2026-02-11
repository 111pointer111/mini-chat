#!/bin/bash

echo "Waiting for backend server to start..."
max_retries=30
counter=0

while [ $counter -lt $max_retries ]; do
    if curl -s http://localhost:5000/health > /dev/null; then
        echo "Server is up!"
        exit 0
    fi
    echo "Waiting for server... ($counter/$max_retries)"
    sleep 1
    counter=$((counter+1))
done

echo "Server failed to start in time."
exit 1
