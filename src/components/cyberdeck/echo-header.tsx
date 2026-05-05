type EchoHeaderProps = {
  activeTabLabel: string;
};

export function EchoHeader({ activeTabLabel }: EchoHeaderProps) {
  return (
    <header className="relative flex shrink-0 items-end justify-end overflow-visible border-b border-gray-800 bg-black px-6 py-2">
      <div
        className="absolute left-6 top-2 font-mono text-[9px] tracking-[0.2em] text-[#8a8a8a]"
        style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
      >
        [{activeTabLabel}]
      </div>
      <pre
        className="cyberdeck-net-logo m-0 whitespace-pre font-mono text-[4px] leading-[1.0] text-green-400"
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
