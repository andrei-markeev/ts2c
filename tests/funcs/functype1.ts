function echo(x){
  return x
}
var obj = {
    echo: echo,
    k: 0
};
console.log(echo(obj.k))
console.log(obj.echo("k"))
console.log(obj.echo(-1))
