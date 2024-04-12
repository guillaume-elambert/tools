#/bin/sh

app=${1:-""}
namespace=${2:-""}
context=${3:-""}


function convert_to_bytes {
    shopt -s nocasematch
    if [[ $1 =~ ^([0-9.]+)([KMGTP]?i?)B?$ ]]; then
        value=${BASH_REMATCH[1]}
        unit=${BASH_REMATCH[2]}
        case $unit in
            ""|Ki)  value=$(echo "$value*1024" | bc) ;;
            Mi)     value=$(echo "$value*1024*1024" | bc) ;;
            Gi)     value=$(echo "$value*1024*1024*1024" | bc) ;;
            Ti)     value=$(echo "$value*1024*1024*1024*1024" | bc) ;;
            Pi)     value=$(echo "$value*1024*1024*1024*1024*1024" | bc) ;;
            *)      echo "Unknown unit: $unit" >&2; return 1 ;;
        esac
    else
        echo "Invalid input: $1" >&2
        return 1
    fi
    echo $value
    return 0
}


toPrint=""

printfFormat="%-35s | %-10s | %-35s |  %-10s"
printf -v toPrint "$printfFormat" "POD NAME" "%MEM POD" "NODE NAME" "%MEM NODE"

podsJson=$(kubectl get pods -n $namespace --context=$context -lapp=$app --output=json | jq -r '.items[]')

for podName in $(echo $podsJson | jq -r '.metadata.name'); do

  jqSelector="echo \$podsJson | jq -r --arg podName \"\$podName\" '. | select(.metadata.name == \$podName) | %s'"

  nodeName=$(eval $(printf "$jqSelector" ".spec.nodeName"))

  podMemoryUsage=$(kubectl top pod $podName -n $namespace --no-headers | awk '{print $3}')
  podMemoryUsage=$(convert_to_bytes $podMemoryUsage)
  
  podMemoryLimit=$(eval $(printf "$jqSelector" ".spec.containers[0].resources.limits.memory"))
  podMemoryLimit=$(convert_to_bytes $podMemoryLimit)
  
  podMemoryPercentage=$(echo "scale=0; $podMemoryUsage * 100 / $podMemoryLimit" | bc)%
  
  nodeMemoryPercentage=$(kubectl top node $nodeName --context=$context --no-headers=true | awk '{print $5}')

  toPrintTemp=""
  printf -v toPrintTemp "$printfFormat" "$podName" "$podMemoryPercentage" "$nodeName" "$nodeMemoryPercentage"
  toPrint=$(echo -e "$toPrint\n$toPrintTemp")
done

echo "$toPrint"