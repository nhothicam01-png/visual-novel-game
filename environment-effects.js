/* Danh sách hiệu ứng môi trường độc lập với thư viện hiệu ứng chính. */
(() => {
  'use strict';
  const registry = [
    {id:'snow',label:'Tuyết rơi'},
    {id:'rain',label:'Mưa'},
    {id:'petals',label:'Cánh hoa bay'},
    {id:'dust',label:'Bụi sáng'},
    {id:'sparkle',label:'Lấp lánh'},
    {id:'fog',label:'Sương mờ'},
    {id:'rays',label:'Tia nắng'},
    {id:'lightning',label:'Chớp sáng'},
    {id:'vignette',label:'Tối góc'},
    {id:'flash',label:'Flash trắng'}
  ];
  function list(){return registry.map(item=>({...item}));}
  window.VNEnvironmentEffects=Object.freeze({list,registry});
})();
