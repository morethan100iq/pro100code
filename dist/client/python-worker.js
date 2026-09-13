let pyodide;
async function load(){
 try{importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.js');pyodide=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/'});postMessage({type:'ready'});}
 catch{postMessage({type:'load-error',text:'Не удалось загрузить среду Python. Для первого запуска требуется подключение к интернету.'});}
}
onmessage=async({data})=>{
 if(data.type!=='run'||!pyodide)return;
 let outputSize=0;const output=text=>{if(outputSize<30000){const clipped=text.slice(0,30000-outputSize);postMessage({type:'output',text:clipped});outputSize+=clipped.length+1;}};
 const lines=data.input.split('\n');if(!data.input)lines.length=0;
 pyodide.setStdout({batched:output});pyodide.setStderr({batched:output});pyodide.setStdin({stdin:()=>lines.length?lines.shift():null});
 const globals=pyodide.toPy({__name__:'__main__'});
 try{const result=await pyodide.runPythonAsync(data.code,{globals});if(result!==undefined){output(String(result));result?.destroy?.();}postMessage({type:'done'});}
 catch(error){output(error.message);postMessage({type:'done',error:true});}
 finally{globals.destroy();}
};
load();
