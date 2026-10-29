(function(){
  var NODES={
    SZX:{n:'Shenzhen',x:700,y:150,t:'sup'},
    HCM:{n:'Ho Chi Minh',x:668,y:238,t:'sup'},
    SIN:{n:'Singapore',x:610,y:300,t:'port'},
    CMB:{n:'Colombo',x:545,y:262,t:'port'},
    DXB:{n:'Dubai',x:455,y:150,t:'port'},
    CPT:{n:'Cape Town',x:395,y:352,t:'port'},
    MUM:{n:'Mumbai',x:520,y:196,t:'dest'},
    RTM:{n:'Rotterdam',x:360,y:66,t:'dest'},
    LAX:{n:'Los Angeles',x:100,y:132,t:'dest'}
  };
  var BASE=[
    {id:'S-2041',cargo:'Display modules',route:['SZX','SIN','MUM'],mode:'Sea',value:480,eta:9,p:.30},
    {id:'S-2042',cargo:'EV battery cells',route:['HCM','SIN','MUM'],mode:'Sea',value:640,eta:11,p:.12},
    {id:'S-2043',cargo:'Textile rolls',route:['SZX','LAX'],mode:'Sea',value:210,eta:18,p:.45},
    {id:'S-2044',cargo:'Pharma ingredients',route:['MUM','DXB','RTM'],mode:'Sea',value:720,eta:16,p:.20},
    {id:'S-2045',cargo:'Auto parts',route:['SIN','DXB','RTM'],mode:'Sea',value:390,eta:15,p:.55},
    {id:'S-2046',cargo:'Solar panels',route:['SZX','SIN','DXB','RTM'],mode:'Sea',value:560,eta:21,p:.25},
    {id:'S-2047',cargo:'Consumer electronics',route:['HCM','LAX'],mode:'Sea',value:330,eta:19,p:.60},
    {id:'S-2048',cargo:'Machinery spares',route:['SIN','MUM'],mode:'Air',value:175,eta:6,p:.40},
    {id:'S-2049',cargo:'Footwear',route:['SZX','LAX'],mode:'Sea',value:140,eta:17,p:.15},
    {id:'S-2050',cargo:'Medical devices',route:['MUM','DXB','RTM'],mode:'Sea',value:410,eta:13,p:.70}
  ];
  var BASE_SPEND=312;

  function nextHopAfter(r,id){var i=r.indexOf(id);return i>=0?r[i+1]:undefined;}
  var EVENTS=[
    {id:'sin',name:'Port congestion',where:'Singapore',node:'SIN',delay:6,
     hit:function(s){return s.route.indexOf('SIN')>=0;},
     signal:'Berth waiting time at Singapore hit 6 days, up from 1.',
     opts:[
      {k:'a',label:'Reroute through Colombo',desc:'Swap Singapore for Colombo on every shipment that only transits it. Shipments that start in Singapore get priority berthing.',cost:6.8,resid:1.5,conf:86,rec:true,
       route:function(r){return r.map(function(id,i){return id==='SIN'&&i>0&&i<r.length-1?'CMB':id;});},
       why:'It recovers about 4.5 days per shipment for $6.8K, the lowest cost per day saved.'},
      {k:'b',label:'Wait it out',desc:'Keep every booking as is and let the queue clear.',cost:0,resid:6,conf:62,why:'Free, but every affected shipment arrives about 6 days late.'},
      {k:'c',label:'Air-freight priority cargo',desc:'Move the most valuable lots by air and leave the rest at sea.',cost:21,resid:.5,conf:91,why:'Fastest fix, but three times the cost of rerouting.'}
     ]},
    {id:'typhoon',name:'Typhoon warning',where:'South China Sea',node:'SZX',delay:4,
     hit:function(s){return s.route[0]==='SZX';},
     signal:'A typhoon is forecast to close Shenzhen terminals for about 4 days.',
     opts:[
      {k:'a',label:'Load from Ho Chi Minh instead',desc:'Fulfil the orders from the Vietnam supplier and ship from there.',cost:3.1,resid:1,conf:82,rec:true,
       route:function(r){var c=r.slice();c[0]='HCM';return c;},
       why:'The alternate supplier has stock and recovers 3 of 4 days for $3.1K.'},
      {k:'b',label:'Delay departure 48 hours',desc:'Hold cargo at the warehouse until the storm passes.',cost:.6,resid:3,conf:70,why:'Cheap, but customers still see a 3 day delay.'},
      {k:'c',label:'Air-freight from Hong Kong',desc:'Truck cargo to Hong Kong and fly it out.',cost:14,resid:.5,conf:88,why:'Nearly no delay, at four times the cost of switching supplier.'}
     ]},
    {id:'suez',name:'Red Sea closure',where:'Dubai to Rotterdam',node:'DXB',delay:12,
     hit:function(s){return nextHopAfter(s.route,'DXB')==='RTM';},
     signal:'Carriers have suspended the Red Sea and Suez transit. Dubai to Rotterdam sailings are stopping.',
     opts:[
      {k:'a',label:'Divert around the Cape',desc:'Sail via Cape Town. Longer, but the lane stays open.',cost:11.2,resid:7,conf:84,rec:true,
       route:function(r){var c=[];r.forEach(function(id,i){c.push(id);if(id==='DXB'&&r[i+1]==='RTM')c.push('CPT');});return c;},
       why:'Cuts the delay from 12 days to 7 and keeps cargo moving by sea.'},
      {k:'b',label:'Hold in Dubai',desc:'Park cargo in the bonded warehouse until the route reopens.',cost:2.4,resid:12,conf:48,why:'Cheap, but the reopening date is unknown.'},
      {k:'c',label:'Sea-air via Dubai airport',desc:'Fly the cargo from Dubai to Europe.',cost:26,resid:2,conf:90,why:'Only 2 days late, but it costs more than twice the Cape route.'}
     ]},
    {id:'customs',name:'Customs hold',where:'Mumbai',node:'MUM',delay:5,
     hit:function(s){return s.route[s.route.length-1]==='MUM';},
     signal:'A document audit is holding inbound containers at Mumbai.',
     opts:[
      {k:'a',label:'Pre-clear with a licensed broker',desc:'File the corrected paperwork and ask for a green-channel release.',cost:1.8,resid:1,conf:88,rec:true,
       why:'Releases cargo about 4 days sooner for under $2K.'},
      {k:'b',label:'Wait for the audit to finish',desc:'Respond only if customs asks for more.',cost:0,resid:5,conf:55,why:'Free, but every shipment waits the full 5 days.'},
      {k:'c',label:'Divert to Colombo and feed back',desc:'Land at Colombo and bring cargo in on a coastal feeder.',cost:5.4,resid:3,conf:72,why:'Saves 2 days but adds handling and a second port call.'}
     ]}
  ];

  var ships,extra,executed,scenario,selected,filter,busy,timers=[],auto=false,dots={},pathEls={},pathLen={},lastT=0;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(id){return document.getElementById(id);};
  var NS='http://www.w3.org/2000/svg';

  function money(k){return k>=1000?'$'+(k/1000).toFixed(2)+'M':'$'+k.toFixed(1)+'K';}
  function clock(){return new Date().toLocaleTimeString('en-GB');}
  function status(s){return s.delay<=0?'ok':(s.delay<=2?'warn':'crit');}
  function statusLabel(s){return {ok:'On time',warn:'Watch',crit:'Delayed'}[status(s)];}
  function later(fn,ms){timers.push(setTimeout(fn,ms));}
  function clearTimers(){timers.forEach(clearTimeout);timers=[];}

  function init(){
    clearTimers();
    ships=JSON.parse(JSON.stringify(BASE));
    ships.forEach(function(s){s.delay=0;});
    extra=0;executed=0;scenario=null;selected=null;filter='all';busy=false;
    auto=false;$('autopilot').checked=false;$('autoNote').hidden=true;
    $('stream').innerHTML='';$('options').innerHTML='';
    setPipe(-1);
    $('agentState').textContent='Watching';
    say('Sentinel','Watching '+ships.length+' shipments across '+Object.keys(NODES).length+' locations. All lanes normal.','ok');
    syncFilters();
    renderAll();
  }

  function say(agent,text,tone){
    var d=document.createElement('div');d.className='msg '+(tone||'');
    d.innerHTML='<span class="t">'+clock()+'</span><span class="w"><b>'+agent+'</b> '+text+'</span>';
    var st=$('stream');st.appendChild(d);st.scrollTop=st.scrollHeight;
  }
  function setPipe(k,doneAll){
    Array.prototype.forEach.call($('pipe').children,function(li,i){
      li.className=doneAll?'done':(i<k?'done':(i===k?'on':''));
    });
  }

  /* map */
  function ctrl(a,b){
    var A=NODES[a],B=NODES[b],dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    if(ny>0){nx=-nx;ny=-ny;}
    var k=Math.min(70,len*.22);
    return {x:(A.x+B.x)/2+nx*k,y:(A.y+B.y)/2+ny*k};
  }
  function pathD(route){
    var d='';
    route.forEach(function(id,i){
      var P=NODES[id];
      if(i===0){d+='M'+P.x+' '+P.y;return;}
      var c=ctrl(route[i-1],id);
      d+=' Q'+c.x.toFixed(1)+' '+c.y.toFixed(1)+' '+P.x+' '+P.y;
    });
    return d;
  }
  function el(tag,attrs,parent){
    var e=document.createElementNS(NS,tag);
    for(var k in attrs)e.setAttribute(k,attrs[k]);
    if(parent)parent.appendChild(e);return e;
  }
  function drawMap(){
    var lanes=$('lanes'),nodes=$('nodes'),paths=$('paths'),dg=$('dots'),hl=$('hlg');
    lanes.innerHTML='';nodes.innerHTML='';paths.innerHTML='';hl.innerHTML='';
    var seen={};
    var badNode=scenario&&!scenario.done?scenario.node:null;
    ships.forEach(function(s){
      for(var i=1;i<s.route.length;i++){
        var a=s.route[i-1],b=s.route[i],key=[a,b].sort().join('-');
        if(seen[key])continue;seen[key]=1;
        var bad=badNode&&(a===badNode||b===badNode);
        el('path',{d:pathD([a,b]),'class':'lane'+(bad?' bad':'')},lanes);
      }
      var p=el('path',{d:pathD(s.route),id:'p-'+s.id},paths);
      pathEls[s.id]=p;pathLen[s.id]=p.getTotalLength();
    });
    var used={};ships.forEach(function(s){s.route.forEach(function(id){used[id]=1;});});
    if(badNode)used[badNode]=1;
    Object.keys(NODES).forEach(function(id){
      if(!used[id])return;
      var N=NODES[id],bad=badNode===id;
      if(bad)el('circle',{cx:N.x,cy:N.y,r:9,'class':'pulse'},nodes);
      if(N.t==='sup')el('rect',{x:N.x-7,y:N.y-7,width:14,height:14,rx:2,'class':'nd sup'+(bad?' bad':'')},nodes);
      else el('circle',{cx:N.x,cy:N.y,r:N.t==='dest'?8:6.5,'class':'nd '+(N.t==='dest'?'dest':'')+(bad?' bad':'')},nodes);
      var anchor=(N.x>690)?'end':'start',dx=(N.x>690)?-14:14;
      var tx=el('text',{x:N.x+dx,y:N.y+4,'class':'nl','text-anchor':anchor},nodes);
      tx.textContent=N.n;
    });
    if(selected){
      var sh=ships.filter(function(s){return s.id===selected;})[0];
      if(sh)el('path',{d:pathD(sh.route),'class':'hl'},hl);
    }
    dg.innerHTML='';dots={};
    ships.forEach(function(s){
      dots[s.id]=el('circle',{r:5.5,'class':'sd '+status(s)+(s.id===selected?' sel':'')},dg);
      placeDot(s);
    });
    $('mapMeta').textContent=ships.length+' shipments in transit';
  }
  function placeDot(s){
    var p=pathEls[s.id],d=dots[s.id];if(!p||!d)return;
    var pt=p.getPointAtLength(s.p*pathLen[s.id]);
    d.setAttribute('cx',pt.x.toFixed(1));d.setAttribute('cy',pt.y.toFixed(1));
  }
  function tick(t){
    var dt=Math.min(.1,(t-lastT)/1000||0);lastT=t;
    if(!reduce){
      ships.forEach(function(s){
        s.p+=dt*(.018+(s.value%7)*.0015);
        if(s.p>.97)s.p=.03;
        placeDot(s);
      });
    }
    requestAnimationFrame(tick);
  }

  /* kpis + table */
  function renderKPIs(){
    var n=ships.length,late=ships.filter(function(s){return s.delay>2;}),ok=n-late.length;
    var val=late.reduce(function(a,s){return a+s.value;},0);
    var avg=ships.reduce(function(a,s){return a+s.eta+s.delay;},0)/n;
    var pct=Math.round(ok/n*100);
    var tiles=[
      {l:'On-time delivery',v:pct+'%',s:ok+' of '+n+' shipments',c:pct===100?'ok':(pct>=75?'warn':'crit')},
      {l:'Shipments at risk',v:String(late.length),s:late.length?'More than 2 days late':'None delayed',c:late.length?'crit':'ok'},
      {l:'Value at risk',v:money(val),s:'Cargo value delayed',c:val?'crit':'ok'},
      {l:'Avg transit',v:avg.toFixed(1)+' d',s:'Includes current delays',c:''},
      {l:'Freight spend',v:money(BASE_SPEND+extra),s:extra?'+'+money(extra)+' from '+executed+' agent action'+(executed>1?'s':''):'On budget',c:extra?'warn':''}
    ];
    $('kpis').innerHTML=tiles.map(function(t){
      return '<div class="kpi '+t.c+'"><div class="l">'+t.l+'</div><div class="v">'+t.v+'</div><div class="s">'+t.s+'</div></div>';
    }).join('');
  }
  function routeHtml(r){return '<span class="rt">'+r.map(function(id,i){return (i===0||i===r.length-1)?'<b>'+id+'</b>':id;}).join(' → ')+'</span>';}
  function renderTable(){
    var rows=ships.filter(function(s){
      if(filter==='risk')return s.delay>2;
      if(filter==='ok')return s.delay<=2;
      return true;
    });
    $('rows').innerHTML=rows.length?rows.map(function(s){
      var st=status(s);
      return '<tr class="row'+(s.id===selected?' sel':'')+'" data-id="'+s.id+'" tabindex="0">'+
        '<td class="mono">'+s.id+'</td><td>'+s.cargo+'</td><td>'+routeHtml(s.route)+'</td><td>'+s.mode+'</td>'+
        '<td class="mono num">'+(s.eta+s.delay).toFixed(s.delay%1?1:0)+' d'+(s.delay>0?' <span style="color:var(--'+(st==='crit'?'crit':'warn')+')">(+'+s.delay+')</span>':'')+'</td>'+
        '<td><span class="pill '+st+'">'+statusLabel(s)+'</span></td><td class="mono num">'+money(s.value)+'</td></tr>';
    }).join(''):'<tr><td colspan="7" style="color:var(--muted);padding:18px 10px">No shipments match this filter.</td></tr>';
  }
  function renderSim(){
    $('simBtns').innerHTML=EVENTS.map(function(e){
      return '<button class="ev" type="button" data-e="'+e.id+'"'+(busy?' disabled':'')+'><b>'+e.name+'</b><span>'+e.where+'</span></button>';
    }).join('');
  }
  function renderAll(){renderKPIs();renderTable();renderSim();drawMap();document.dispatchEvent(new CustomEvent('sp:update'));}
  function syncFilters(){
    Array.prototype.forEach.call($('filters').children,function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-f')===filter));});
  }

  /* agent flow */
  function trigger(id){
    if(busy)return;
    var ev=EVENTS.filter(function(e){return e.id===id;})[0];
    var hit=ships.filter(ev.hit);
    busy=true;
    scenario={ev:ev,node:ev.node,done:false,hit:hit};
    $('options').innerHTML='';
    $('agentState').textContent='Working';
    renderSim();
    setPipe(0);
    say('Sentinel',ev.signal,'crit');
    drawMap();
    later(function(){
      setPipe(1);
      hit.forEach(function(s){s.delay=ev.delay;});
      var val=hit.reduce(function(a,s){return a+s.value;},0);
      say('Analyst',hit.length+' shipments are affected ('+hit.map(function(s){return s.id;}).join(', ')+'). Expected delay '+ev.delay+' days, '+money(val)+' of cargo at risk.','accent');
      renderAll();
    },1100);
    later(function(){
      setPipe(2);
      say('Planner','Simulated '+ev.opts.length+' responses and ranked them by cost per day saved.','accent');
      showOptions();
    },2300);
  }
  function showOptions(){
    var ev=scenario.ev;
    $('agentState').textContent='Needs your call';
    $('options').innerHTML=ev.opts.map(function(o){
      return '<div class="opt'+(o.rec?' rec':'')+'"><div class="opt-h"><b>'+o.label+'</b>'+(o.rec?'<span class="tag">Recommended</span>':'')+'</div>'+
        '<p>'+o.desc+'</p><div class="stats"><span><em>Cost </em>'+money(o.cost)+'</span><span><em>Delay left </em>'+o.resid+' d</span><span><em>Confidence </em>'+o.conf+'%</span></div>'+
        '<button class="go'+(o.rec?'':' alt')+'" type="button" data-o="'+o.k+'">Approve this plan</button></div>';
    }).join('');
    if(auto){
      var rec=ev.opts.filter(function(o){return o.rec;})[0];
      later(function(){
        if(!scenario||scenario.done)return;
        say('Autopilot','Approved the recommended plan: '+rec.label+'.','ok');
        execute(rec.k);
      },2200);
    }
  }
  function execute(k){
    if(!scenario||scenario.done)return;
    var ev=scenario.ev,o=ev.opts.filter(function(x){return x.k===k;})[0];
    scenario.done=true;
    $('options').innerHTML='';
    setPipe(3);
    $('agentState').textContent='Executing';
    var n=0;
    scenario.hit.forEach(function(s,i){
      later(function(){
        var before=s.route.join(),msg;
        if(o.route){
          var nr=o.route(s.route);
          if(nr.join()!==before){
            s.route=nr;s.delay=o.resid;
            msg='Simulated rebooking of '+s.id+' via '+nr.join(' → ')+'.';
          }else{
            s.delay=Math.max(1,Math.round(s.delay/2));
            msg=s.id+' cannot be rerouted from its origin. Requested priority handling, delay cut to '+s.delay+' d.';
          }
        }else{
          s.delay=o.resid;
          msg='Simulated update for '+s.id+': '+(o.resid<=.5?'moved to air freight':'new plan applied')+', delay now '+o.resid+' d.';
        }
        say('Executor',msg);
        n++;
        renderAll();
      },i*650);
    });
    later(function(){
      extra+=o.cost;executed++;
      scenario.node=null;
      say('Executor','Plan recorded (simulated: no carrier or customer was contacted). Added '+money(o.cost)+' to freight spend.','ok');
      setPipe(3,true);
      $('agentState').textContent='Watching';
      busy=false;
      renderAll();
    },scenario.hit.length*650+500);
  }

  /* ask the agent */
  function answer(q){
    if(q==='risk'){
      var late=ships.filter(function(s){return s.delay>2;});
      say('You','What is at risk?');
      say('Agent',late.length?late.length+' shipments are more than 2 days late: '+late.map(function(s){return s.id+' ('+s.cargo.toLowerCase()+', +'+s.delay+' d)';}).join('; ')+'.':'Nothing is more than 2 days late right now.',late.length?'crit':'ok');
    }else if(q==='cost'){
      say('You','What have your actions cost?');
      say('Agent',executed?executed+' action'+(executed>1?'s':'')+' so far, adding '+money(extra)+' to a baseline of '+money(BASE_SPEND)+'.':'No actions yet, so spend is still at the '+money(BASE_SPEND)+' baseline. Trigger a disruption to see me work.');
    }else{
      say('You','Why this pick?');
      if(scenario&&!scenario.done){
        var rec=scenario.ev.opts.filter(function(o){return o.rec;})[0];
        say('Agent',rec.label+': '+rec.why,'accent');
      }else say('Agent','There is no open decision. Trigger a disruption and ask again.');
    }
  }

  /* events */
  $('simBtns').addEventListener('click',function(e){var b=e.target.closest('[data-e]');if(b)trigger(b.getAttribute('data-e'));});
  $('options').addEventListener('click',function(e){
    var b=e.target.closest('[data-o]');if(!b)return;
    var o=scenario.ev.opts.filter(function(x){return x.k===b.getAttribute('data-o');})[0];
    say('You','Approved: '+o.label+'.');
    execute(o.k);
  });
  $('ask').addEventListener('click',function(e){var b=e.target.closest('[data-q]');if(b)answer(b.getAttribute('data-q'));});
  $('filters').addEventListener('click',function(e){var b=e.target.closest('[data-f]');if(!b)return;filter=b.getAttribute('data-f');syncFilters();renderTable();});
  function pick(id){selected=(selected===id)?null:id;renderTable();drawMap();}
  $('rows').addEventListener('click',function(e){var r=e.target.closest('tr[data-id]');if(r)pick(r.getAttribute('data-id'));});
  $('rows').addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    var r=e.target.closest('tr[data-id]');if(r){e.preventDefault();pick(r.getAttribute('data-id'));}
  });
  $('autopilot').addEventListener('change',function(e){auto=e.target.checked;$('autoNote').hidden=!auto;});
  document.addEventListener('sp:viewshown',function(e){if(e.detail==='tower')drawMap();});
  window.SP={state:function(){return {ships:ships,extra:extra,executed:executed,base:BASE_SPEND};}};
  $('reset').addEventListener('click',init);

  init();
  requestAnimationFrame(tick);
})();
