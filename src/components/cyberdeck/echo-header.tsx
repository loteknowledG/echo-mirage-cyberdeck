type EchoHeaderProps = {
  statusChipText: string;
};

export function EchoHeader({ statusChipText }: EchoHeaderProps) {
  return (
    <header className="relative flex w-full shrink-0 items-end justify-between gap-3 overflow-visible border-b border-gray-800 bg-black px-6 py-2">
      <div
        className="shrink-0 rounded border border-[#2d2d2d] px-2 py-1 font-mono text-[9px] tracking-[0.06em] text-[#8a8a8a]"
        style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
      >
        {statusChipText}
      </div>
      <pre
        className="cyberdeck-net-logo m-0 min-w-0 shrink whitespace-pre font-mono text-[4px] leading-[1.0] text-green-400"
        style={{ textShadow: "0 0 5px #00ff00" }}
      >
        {`
          _            _             _       _    _       
        ╱╲ ╲         ╱╲ ╲           ╱ ╱╲    ╱ ╱╲ ╱╲ ╲     
       ╱  ╲ ╲       ╱  ╲ ╲         ╱ ╱ ╱   ╱ ╱ ╱╱  ╲ ╲    
      ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲ ╲       ╱ ╱_╱   ╱ ╱ ╱╱ ╱╲ ╲ ╲   
     ╱ ╱ ╱╲ ╲_╲   ╱ ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲__╱ ╱ ╱╱ ╱ ╱╲ ╲ ╲  
    ╱ ╱_╱_ ╲╱_╱  ╱ ╱ ╱  ╲ ╲_╲   ╱ ╱╲ ╲___╲╱ ╱╱ ╱ ╱  ╲ ╲_╲ 
   ╱ ╱____╱╲    ╱ ╱ ╱    ╲╱_╱  ╱ ╱ ╱╲╱___╱ ╱╱ ╱ ╱   ╱ ╱ ╱ 
  ╱ ╱╲____╲╱   ╱ ╱ ╱          ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱   ╱ ╱ ╱  
 ╱ ╱ ╱______  ╱ ╱ ╱________  ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱___╱ ╱ ╱   
╱ ╱ ╱_______╲╱ ╱ ╱_________╲╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱____╲╱ ╱    
╲╱__________╱╲╱____________╱╲╱_╱    ╲╱_╱ ╲╱_________╱`}
      </pre>
    </header>
  );
}
