
function order(product){
let msg = `Hi, I want to order ${product} from HM Live Khakhara`;
window.open("https://wa.me/919423458579?text="+encodeURIComponent(msg));
}

function sendOrder(){
let name=document.getElementById("name").value;
let flavour=document.getElementById("flavour").value;
let qty=document.getElementById("qty").value;
let msg=`Hi, my name is ${name}. I want ${qty} pack(s) of ${flavour}.`;
window.open("https://wa.me/919423458579?text="+encodeURIComponent(msg));
}
