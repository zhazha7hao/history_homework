(function(){
  var lb=document.getElementById('lb');
  var lbImg=document.getElementById('lbImg');
  var lbCap=document.getElementById('lbCap');
  function openLb(src,cap){lbImg.src=src;lbCap.textContent=cap||'';
    lb.classList.add('show');lb.setAttribute('aria-hidden','false');}
  function closeLb(){lb.classList.remove('show');lb.setAttribute('aria-hidden','true');}
  document.addEventListener('click',function(e){
    var t=e.target.closest && e.target.closest('[data-lb]');
    if(t){e.preventDefault();openLb(t.getAttribute('src'),t.getAttribute('data-lb-cap')||t.alt);}
  });
  document.getElementById('lbClose').addEventListener('click',closeLb);
  lb.addEventListener('click',function(e){if(e.target===lb)closeLb();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLb();});
})();