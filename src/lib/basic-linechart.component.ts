import { Component, ElementRef, EventEmitter, Input, OnInit, Output, Renderer2, SimpleChanges, ViewChild } from '@angular/core';
import {ScaleTime, ScaleLinear} from 'd3-scale';
import {Selection} from 'd3-selection';
import * as d3 from 'd3';

export interface Data {
  label: string;
  values: [number,number][];
  color: string;
  style: "line" | "area" | "both";
  interpolation: "linear" | "step";
}

@Component({
  selector: 'lib-basic-linechart',
  template: `
  <h2>{{ title }}</h2>
  <svg #root [attr.width]="width" [attr.height]="height"></svg>
  <div #zone><div #scroll></div></div>
  `,
  styles: [
  ]
})
export class BasicLinechartComponent implements OnInit {
  @Input() width: number = 900;
  @Input() height: number = 200; 
  @Input() data: Data[] = [];
  @Input() domain: [number, number] = [0,0];
  @ViewChild('root') timeline!: ElementRef;
  @ViewChild('scroll') scrollbar!: ElementRef;
  @ViewChild('zone') zoneScrollbar!: ElementRef;
  @Input() range: [number,number] = [0,0];
  @Output() rangeChange = new EventEmitter<[number,number]>();
  @Input() currentTime: number = 0;
  @Output() currentTimeChange = new EventEmitter<number>();

  public title:string = 'Timeline : ';
  private margin = { top: 20, right: 20, bottom: 30, left: 50 }; //marge interne au svg 
  private dataZoom: Data[] = [];
  private idZoom: number = 0;
  private minTime: number = 0;
  private maxTime: number = 0;
  private lengthTime: number = 0;
  private svgWidth: number = 0;
  private svgHeight: number = 0;
  private scaleX: ScaleTime<number,number> = d3.scaleTime();
  private scaleY: ScaleLinear<number,number> = d3.scaleLinear();
  private svg: any;
  private area: d3.Area<[number, number]>[] = [];
  private line: d3.Line<[number, number]>[] = [];
  private tooltip!: Selection<SVGGElement,unknown,null,undefined>;
  private lastDatalength:number = 0;
  private modeToolTips: "normal" | "inverse" = "normal";
  private currentTimeSelected:boolean = false;
  private scrollbarSelected:boolean = false;
  private lastPos: number = 0;
  
  
  constructor(private renderer: Renderer2) {   
  }

  /**
   * Copy data in dataZoom, and build title 
   */
  public ngOnInit(): void {
    this.dataZoom = [...this.data];
    this.lastDatalength=this.dataZoom.length;
    this.data.forEach((element,index) => {
      if(index==this.data.length-1) this.title = this.title+element.label+'.';
      else this.title = this.title+element.label + ', ';
    })
  }

  /**
   * Initialize linechart
   */
  public ngAfterViewInit(): void {
    if (this.timeline != undefined) {
      let w = this.timeline.nativeElement.width.animVal.value;
      let h = this.timeline.nativeElement.height.animVal.value;
      this.svgWidth = (w - this.margin.left) - this.margin.right;
      this.svgHeight = (h - this.margin.top) - this.margin.bottom;
    }
    this.data.forEach((element,index) => this.buildStyleData(element,index));
    this.buildZoom(); 
    this.buildEvent();
    this.drawToolTips();
    this.drawAxis();
    this.drawLineAndPath();
    this.drawLineCurrentTime();
    this.drawScrollbar();
  }

  /**
   * Update linechart on data, range or current time changes
   * @param {SimpleChanges} changes 
   */
  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.data&&!changes.data.firstChange) this.updateChart();
    if ((changes.data&&!changes.data.firstChange&&this.range[0]!=0&&this.range[1]!=0)||(changes.range&&!changes.range.firstChange)) {
      this.idZoom=Math.round(Math.log(this.lengthTime/(this.range[1]-this.range[0]))/Math.log(1.5));
      this.range=this.controlRange(this.range[0],this.range[1]-this.range[0]);
      if(this.data.length!=0){
        this.updateDataZoom(this.range[0],this.range[1]);
        this.updateSvg(this.range[0],this.range[1]);
      }
    }
    if (changes.currentTime&&!changes.currentTime.firstChange&&this.data.length!=0) this.updateCurrentTime();
}

  /**
   * Add event listeners on the svg
   */
  private buildEvent(): void{ // creer une timeline avec une seul donnée
    this.svg = d3.select(this.timeline.nativeElement)
    .append('g')
    .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
    d3.select(this.timeline.nativeElement).on("mousemove", (event: MouseEvent) => {
      if(this.currentTimeSelected) this.moveCurrentTime(event);
      else this.showInfo(event);
    })
    .on("mouseleave", () => { this.currentTimeSelected = false; this.hideInfo() })
    .on("wheel", (event: WheelEvent) => {if(this.data.length!=0)this.activeZoom(event)})
    .on("mouseup", () => this.currentTimeSelected=false)
    .on("mouseover", (event: MouseEvent) => event.preventDefault());
  }

  /**
   * Build the style (area, line or both) and the interpolation (stpe or linear) of lines
   * @param {Data} element 
   * @param {number} index 
   */
  private buildStyleData(element:Data, index:number): void{
    if(element.style=="area" || element.style=="both"){
      if(element.interpolation=="step"){
        this.area[index]=d3.area()
        .x((d: number[]) => this.scaleX(d[0]))
        .y0(this.svgHeight)
        .y1((d: number[]) => this.scaleY(d[1]))
        .curve(d3.curveStepAfter);
      }else{
        this.area[index]=d3.area()
        .x((d: number[]) => this.scaleX(d[0]))
        .y0(this.svgHeight)
        .y1((d: number[]) => this.scaleY(d[1]))
      }
    }
    if(element.style=="line" || element.style=="both"){
      if(element.interpolation=="step"){
        this.line[index]=d3.line()
        .x((d: number[]) => this.scaleX(d[0]))
        .y((d: number[]) => this.scaleY(d[1]))
        .curve(d3.curveStepAfter);
      }else{
        this.line[index]=d3.line()
        .x((d: number[]) => this.scaleX(d[0]))
        .y((d: number[]) => this.scaleY(d[1]))
      }
    }
    if(!this.controlColor(element.color)){
      console.warn("Data with " + element.label + " label, has an unvalid color attribute (" + element.color + "). Replace with the default color (black).");
      element.color="black";
    } 
  }

  /**
   * Save information for zoom.
   */
  private buildZoom(): void{
    this.minTime = this.scale(this.data,"xMin");
    this.maxTime = this.scale(this.data,"xMax");
    this.lengthTime = this.maxTime - this.minTime;
    this.idZoom=0;
  }

  /**
   * Draw the tooltips's svg
   */
  private drawToolTips(): void{ //creer le tooltips
    this.tooltip = this.svg.append("g")
        .attr("id", "tooltip")
        .style("display", "none");
    // Le cercle extérieur bleu clair
    this.tooltip.append("circle")
        .attr("fill", "#CCE5F6")
        .attr("r", 10);
    // Le cercle intérieur bleu foncé
    this.tooltip.append("circle")
        .attr("fill", "#3498db")
        .attr("stroke", "#fff")
        .attr("stroke-width", "1.5px")
        .attr("r", 4);
    // Le tooltip en lui-même avec sa pointe vers le bas
    // Il faut le dimensionner en fonction du contenu
    if (this.modeToolTips == "normal") {
      this.tooltip.append("polyline")
        .attr("points", "0,0 0,40 75,40  80,45  85,40  160,40  160,0 0,0")
        .style("fill", "#fafafa")
        .style("stroke","#3498db")
        .style("opacity","0.9")
        .style("stroke-width","1")
        .attr("transform", "translate(-80,-50)");
      this.dataZoom.forEach((element) => {
        // Cet élément contiendra tout notre texte
        let text = this.tooltip.append("text")
          .style("font-size", "13px")
          .style("font-family", "Segoe UI")
          .style("color", element.color)
          .style("fill", element.color)
          .attr("transform", "translate(-80,-42)");
        // Element pour la date avec positionnement spécifique
        text.append("tspan")
          .attr("dx", "7")
          .attr("dy", "5")
          .attr("id", "tooltip-date1");
        text.append("tspan")
          .attr("dx", "-90")
          .attr("dy", "15")
          .attr("id", "tooltip-date2");
      });
    }else {
      this.tooltip.append("polyline")
        .attr("points", "0,95 , 0,55 , 75,55 , 80,50 , 85,55 , 160,55 , 160,95 0,95")
        .style("fill", "#fafafa")
        .style("stroke","#3498db")
        .style("opacity","0.9")
        .style("stroke-width","1")
        .attr("transform", "translate(-80,-50)");
      this.dataZoom.forEach((element) => {
        // Cet élément contiendra tout notre texte
        let text = this.tooltip.append("text")
          .style("font-size", "13px")
          .style("font-family", "Segoe UI")
          .style("color", element.color)
          .style("fill", element.color)
          .attr("transform", "translate(-80,-30)");
        // Element pour la date avec positionnement spécifique
        text.append("tspan")
          .attr("dx", "7")
          .attr("dy", 50 )
          .attr("id", "tooltip-date1");
        text.append("tspan")
          .attr("dx", "-80")
          .attr("dy", "20")
          .attr("id", "tooltip-date2");
      });
    }
  }

  /**
   * Draw horizontal and vertical axis and scale
   */
  private drawAxis(): void{
    this.scaleX.range([0, this.svgWidth]);
    this.scaleX.domain([this.minTime,this.maxTime]);
    this.scaleY = d3.scaleLinear();
    this.scaleY.range([this.svgHeight, 0]);
    this.scaleY.domain(this.controlDomain());
    // Configure the X Axis
    this.svg.append('g')
      .attr('transform', 'translate(0,' + this.svgHeight + ')')
      .attr('class', 'xAxis')
      .call(d3.axisBottom(this.scaleX));
    // Configure the Y Axis
    if(this.discreteValue(this.data)){
      this.svg.append('g')
      .attr('class', 'yAxis')
      .call(d3.axisLeft(this.scaleY).ticks(this.scale(this.data,"yMax")));
    }else{
      this.svg.append('g')
      .attr('class', 'yAxis')
      .call(d3.axisLeft(this.scaleY));
    }
  }

  /**
   * Draw lines on the line chart
   */
  private drawLineAndPath(): void{
    this.dataZoom.forEach(
      (element,index) => {
        if(element.style=="area" || element.style=="both"){
          this.svg.append('path')
          .datum(this.dataZoom[index].values)
          .attr('class', 'area'+index)
          .attr('d', this.area[index])
          .attr("stroke-width", 0.1)
          .attr('opacity', 0.3)
          .style('fill', element.color)
          .style('stroke', element.color)
          .style('stroke-width', '2px')
        }
        if(element.style=="line" || element.style=="both"){
          this.svg.append('path')
          .datum(element.values)
          .attr('class', 'line'+index)
          .attr('d', this.line[index])
          .style('fill', 'none')
          .style('stroke', element.color)
          .style('stroke-width', '2px')
        }
      }
    )
  }

  /**
   * Draw the vertical line which represents the current time
   */
  private drawLineCurrentTime(): void{
    if(this.data.length!=0){
      if(this.currentTime==0){
        this.currentTime = this.scale(this.data,"xMin");
      }
      let x:number=0;
      this.svg.append('path')
        .datum([[this.currentTime,this.controlDomain()[0]],[this.currentTime,this.svgHeight]])
        .attr('class', 'currentTimeLine')
        .attr('d', d3.line()
          .x((d: number[]) => x=this.scaleX(d[0]))
          .y((d: number[]) => this.scaleY(d[1])))
        .style('fill', 'none')
        .style('stroke', 'red')
        .style('stroke-width', '3px');
      this.svg.append('circle')
        .attr('class', 'currentTimeSelector')
        .attr('cx', x)
        .attr('cy', -13)
        .attr('r', 7)
        .attr('fill', 'red')
        .on("mousedown", () => {
          this.currentTimeSelected=true;
          this.hideInfo();
        })
    }
  }

  /**
   * Draw the scrollbar and event listener on it  
   */
  private drawScrollbar(): void{
    this.zoneScrollbar.nativeElement.style.width = this.svgWidth+"px";
    this.zoneScrollbar.nativeElement.style.marginLeft = this.margin.left+ "px";
    this.zoneScrollbar.nativeElement.style.height = "20px";
    this.zoneScrollbar.nativeElement.style.backgroundColor = "lightgrey";
    this.zoneScrollbar.nativeElement.style.borderRadius = "10px";
    this.scrollbar.nativeElement.style.width = this.svgWidth+"px";
    this.scrollbar.nativeElement.style.height = "20px";
    this.scrollbar.nativeElement.style.backgroundColor = "grey";
    this.scrollbar.nativeElement.style.borderRadius = "10px";
    this.renderer.listen(this.scrollbar.nativeElement, 'mousedown', (event:MouseEvent) => this.activeScrollbar(event));
    this.renderer.listen(this.zoneScrollbar.nativeElement, 'mouseleave', () => this.desactiveScrollbar());
    this.renderer.listen(this.zoneScrollbar.nativeElement, 'mouseup', () => this.desactiveScrollbar());
    this.renderer.listen(this.zoneScrollbar.nativeElement,'mousemove', (event:MouseEvent) => this.updateRange(event));
  }

  /**
   * Update all the line chart (horizontal and vertical axis and scale, data, lines and range) on data changes. 
   */
  private updateChart(): void{
    this.dataZoom = [...this.data];
    this.data.forEach(
      (element,index) => {
        this.buildStyleData(element,index);
        if(element.style=="area") this.svg.selectAll('.line'+index).remove();
        if(element.style=="line") this.svg.selectAll('.area'+index).remove();
        this.title = 'Timeline : ';
        if(index==this.data.length-1) this.title = this.title+element.label+'.';
        else this.title = this.title+element.label + ', ';
    })
    this.buildZoom();
    this.scaleX.domain([this.minTime,this.maxTime]);
    this.scaleY.range([this.svgHeight, 0]);
    this.controlDomain();
    this.scaleY.domain(this.controlDomain());
    if(this.discreteValue(this.data)){
      this.svg.selectAll('.yAxis')
      .call(d3.axisLeft(this.scaleY).ticks(this.scale(this.data,"yMax")));
    }else{
      this.svg.selectAll('.yAxis')
      .call(d3.axisLeft(this.scaleY));
    }
    this.svg.selectAll('.xAxis').call(d3.axisBottom(this.scaleX));
    this.svg.selectAll('.currentTimeLine').remove();
    this.svg.selectAll('.currentTimeSelector').remove();
    this.updateLine();
    this.drawLineCurrentTime();
    this.updateScrollbar(this.minTime,this.maxTime);
    this.updateToolTips();
    for(let index=this.dataZoom.length; index<this.lastDatalength; index++){
      this.svg.selectAll('.line'+index).remove();
      this.svg.selectAll('.area'+index).remove();
    }
    this.lastDatalength=this.dataZoom.length;
  }

  /**
   * Update horizontal axis, current time line, lines and scrollbar
   * @param {number} min of the new range
   * @param {number} max of the new range
   */
  private updateSvg(min: number, max: number){
    this.scaleX.domain([min,max]);
    this.svg.selectAll('.xAxis').call(d3.axisBottom(this.scaleX));
    this.updateLine();
    this.updateCurrentTime();
    this.updateScrollbar(min,max);
  }

  /**
   * Update the display of lines
   */
  private updateLine(): void{
    let lineUpdate;
    let areaUpdate;
    this.dataZoom.forEach((element,index) => {
      if(element.style=="area" || element.style=="both"){
        areaUpdate= this.svg.selectAll('.area'+index).data([this.dataZoom[index].values]);
        areaUpdate
        .enter()
        .append("path")
        .attr('class', 'area'+index)
        .merge(areaUpdate)
        .attr('d', this.area[index])
        .attr("stroke-width", 0.1)
        .attr('opacity', 0.3)
        .style('fill', element.color)
        .style('stroke', element.color)
        .style('stroke-width', '2px');
      }
      if(element.style=="line" || element.style=="both"){
        lineUpdate= this.svg.selectAll('.line'+index).data([this.dataZoom[index].values]);
        lineUpdate
        .enter()
        .append("path")
        .attr('class', 'line'+index)
        .merge(lineUpdate)
        .attr('d', this.line[index])
        .style('fill', 'none')
        .style('stroke', element.color)
        .style('stroke-width', '2px')
      }
    });
  }

  /**
   * Update the position of the current time line
   */
  private updateCurrentTime(): void{
    let lineUpdate = this.svg.selectAll('.currentTimeLine').datum([[this.currentTime,this.controlDomain()[0]],[this.currentTime,this.svgHeight]]);
    let x:number=0;
    lineUpdate.enter()
    .append("path")
    .attr('class', 'currentTimeLine')
    .merge(lineUpdate)
    .attr('d', d3.line()
      .x((d: number[]) => x=this.scaleX(d[0]))
      .y((d: number[]) => this.scaleY(d[1])))
    .style('fill', 'none')
    .style('stroke', 'red')
    .style('stroke-width', '3px');
    if(this.currentTime>=this.scale(this.dataZoom,"xMin")&&this.currentTime<=this.scale(this.dataZoom,"xMax")){
      this.svg.selectAll('.currentTimeLine').attr('display','block');
      this.svg.selectAll('.currentTimeSelector').attr('display','block');
    }else{
      this.svg.selectAll('.currentTimeLine').attr('display','none');
      this.svg.selectAll('.currentTimeSelector').attr('display','none');
    }
    this.svg.selectAll('.currentTimeSelector').attr('cx',x);
  }

  /**
   * Update the position of the scrollbar
   * @param {number} min of the new range
   * @param {number} max of the new range
   */
  private updateScrollbar(min:number, max:number): void{
    this.scrollbar.nativeElement.style.marginLeft= this.svgWidth*(min-this.minTime)/(this.lengthTime) + "px";
    this.scrollbar.nativeElement.style.width= this.svgWidth*(max-min)/(this.lengthTime) + "px";
  }

  /**
   * Change the range, control it, update datas, update the linechart and then emit the new range.
   * @param {MouseEvent} event 
   */
  private updateRange(event: MouseEvent): void{
    if(this.scrollbarSelected){
      event.preventDefault();
      let lengthLocalTime = this.range[1]-this.range[0];
      let lastMinLocalTime = this.scale(this.dataZoom,"xMin");
      let pos = event.clientX-this.margin.left;
      if(this.lastPos==0){
        this.lastPos= pos;
      }
      let minLocalTime = (pos-this.lastPos)*this.lengthTime/this.svgWidth + lastMinLocalTime;
      this.range = this.controlRange(minLocalTime,lengthLocalTime);
      this.updateDataZoom(this.range[0],this.range[1]);
      this.updateSvg(this.range[0],this.range[1]);
      this.rangeChange.emit(this.range);
      this.lastPos=pos;
    }
  }

  /**
   * Change this.dataZoom at range changes
   * @param {number} min of the new range
   * @param {number} max of the new range 
   */
  private updateDataZoom(min:number,max:number): void{
    this.data.forEach((element,index) => {
      this.dataZoom[index]={
        label: element.label,
        values: element.values.filter((element: number[]) => min <= element[0] && element[0] <=  max),
        color: element.color,
        style: element.style,
        interpolation: element.interpolation
    }}) 
    let time: number[];
    this.data.forEach((element,index) => {
      time=[];
      element.values.forEach((element => time.push(element[0])));
      let i = d3.bisectLeft(time, min)-1;
      if(i>=0&&i<this.data[index].values.length){
        this.dataZoom[index].values.unshift([min,(this.data[index].values[i][1])]);
      }
      this.dataZoom[index].values.push([max,this.dataZoom[index].values[this.dataZoom[index].values.length-1][1]]);
    })
  }

  /**
   * Remove and build a new tooltips
   */
  private updateToolTips(): void{
    this.tooltip.remove();
    this.drawToolTips();
  }

  /**
   * Active movement of scrollbar on mousedown on it
   * @param {MouseEvent} event 
   */ 
  private activeScrollbar(event: MouseEvent): void{
    this.scrollbarSelected=true;
    this.lastPos=event.clientX-this.margin.left;
  }

  /**
   * Desactive movement of scrollbar on mouseup or mouseleave on it
   */
  private desactiveScrollbar(): void{
    this.scrollbarSelected=false;
    this.lastPos=0;
  }

  /**
   * Show the tooltips on the movement of the mouse
   * @param {MouseEvent} event 
   */
  private showInfo(event: MouseEvent): void{
    if (this.dataZoom[0] != undefined && this.dataZoom.length <2) {
      var d: number=0;
      var t: number=0;
      let time: number[] = [];
      this.dataZoom[0].values.forEach((element) => time.push(element[0]));
      let x0 = this.scaleX.invert(event.clientX - this.margin.left).getTime();
      let x = d3.bisectRight(time, x0);
      if(x>this.dataZoom[0].values.length-1)x=this.dataZoom[0].values.length-1;
      else if (x < 0) x = 0;
        d  = this.dataZoom[0].values[x][1];
        t = this.dataZoom[0].values[x][0];
      let date = new Date(t).toLocaleDateString("fr", { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
      d3.selectAll('#tooltip-date1')
        .text(date);
      d3.selectAll('#tooltip-date2')
        .text(this.roundDecimal(d, 2));
      this.tooltip.style("display","block");
      this.tooltip.style("opacity", 100);
      this.tooltip.attr("transform", "translate(" + this.scaleX(t) + "," + this.scaleY(d) + ")");
      if (this.scaleY(d) <= 40 * this.dataZoom.length) {
        if (this.modeToolTips != "inverse") {
          this.modeToolTips = "inverse";
          this.updateToolTips();
        }
      } else {
        if (this.modeToolTips != "normal") {
          this.modeToolTips = "normal";
          this.updateToolTips();
        }
      }
    }
  }

  /**
   * Hide the tooltips when the mouse leave the svg 
   */   
  private hideInfo(): void{
    this.tooltip.style("display", "none");
  }

  /**
   * Update the range (reduce or increase) of the linechart on scroll 
   * @param {WheelEvent} event 
   */
  private activeZoom(event: WheelEvent): void{
    event.preventDefault();
    let lastLengthLocalTime = this.lengthTime / Math.pow(1.5,this.idZoom);
    let lastMinLocalTime = this.scale(this.dataZoom,"xMin");
    if((event.deltaY>0&&this.idZoom>0)||event.deltaY<0){
      if(event.deltaY>0&&this.idZoom>0){
        this.idZoom--;
      }else if(event.deltaY<0){
        this.idZoom++; 
      }
      let pos = this.scaleX.invert(event.clientX-this.margin.left).getTime();
      let lengthLocalTime = this.lengthTime / Math.pow(1.5,this.idZoom);
      if(lengthLocalTime>200){
        let minLocalTime = (lastMinLocalTime-pos)*(lengthLocalTime/lastLengthLocalTime) + pos;
        this.range = this.controlRange(minLocalTime,lengthLocalTime);
        this.updateDataZoom(this.range[0],this.range[1]);
        this.updateSvg(this.range[0],this.range[1]);
        this.rangeChange.emit(this.range);
      }else{
        this.idZoom--;
      }
    }
  }

  /**
   * Update the value of current time on the movement of the mouse
   * @param {MouseEvent} event 
   */
  private moveCurrentTime(event: MouseEvent): void{
    event.preventDefault();
    let pos = this.scaleX.invert(event.clientX-this.margin.left).getTime();
    if(pos<this.scale(this.dataZoom,"xMin")){
      this.currentTime=this.scale(this.dataZoom,"xMin");
    }else if(pos>this.scale(this.dataZoom,"xMax")){
      this.currentTime=this.scale(this.dataZoom,"xMax");
    }else{
      this.currentTime=pos;
    }
    this.updateCurrentTime();
    this.currentTimeChange.emit(this.currentTime);
  }

  /**
   * Control the range based on data's timestamp and the new range
   * @param {number} min of the new range
   * @param {number} length of the new range
   * @returns a adjusted range based on data's timestamp
   */
  private controlRange(min:number, length:number) : [number,number]{
    if(this.minTime>min) min=this.minTime;
    let max = min + length;
    if(this.maxTime<max){
      max=this.maxTime;
      min=max - length;
    }
    if(this.minTime>min) min=this.minTime;
    return [min,max];
  }

  /**
   * Control the domain based on data's value type and the input domain
   * @returns a new domain auto-scaled if the input domain is equal to [0,0] or the data's value are positive integers, else return the input domain 
   */
  private controlDomain():[number,number]{
    if((this.domain[0]==0&&this.domain[1]==0)||this.discreteValue(this.data)){
      return [this.scale(this.data,"yMin"),this.scale(this.data,"yMax")];
    }else{
      return this.domain;
    }
  }

  /**
   * Control the color based on css-colors-name and hex-color-code
   * @param {string} color 
   * @returns false if the param color isn't a css-colors-name or a valid hex-color-code
   */
  private controlColor(color: string):boolean{
    let s = new Option().style;
    s.color = color;
    return s.color!="";
  }

  /** 
   * Determine the minimum or maximum of the horizontal or vertical axis in data
   * @param {Data[]} data Array of Data
   * @param {"xMin" | "xMax" | "yMin" | "yMax"} s precise wihch scale we want
   * @returns the value that matches with the parameter s in data
   */
  private scale(data: Data[], s: "xMin" | "xMax" | "yMin" | "yMax"): number {
    let res: number = 0;
    data.forEach(
      (elements,index) => elements.values.forEach
      ((element,i) => {
        if((s=="yMin"&&((i==0&&index==0)||element[1]<res))||(s=="yMax"&&((i==0&&index==0)||element[1]>res))) res=element[1];
        else if((s=="xMin"&&((i==0&&index==0)||element[0]<res))||(s=="xMax"&&((i==0&&index==0)||element[0]>res))) res=element[0];
      })
    )
    return res;
  }

  /** 
  *Check type of data (positive integer or float)
  *@param {Data[]} data Array of Data
  *@returns false if there is at least one value in data that's not a positive integer
  */
  private discreteValue(data: Data[]): boolean{
    for(let i:number=0;i<data.length;i++){
      for(let j:number=0;j<data[i].values.length;j++){
        if(data[i].values[j][1]!=Math.round(data[i].values[j][1])) return false;
      }
    }
    return true;
  }

  /**
   * Round a number with a precision
   * @param {number} num 
   * @param {number} precision 
   * @returns a num with a number of decimal (precision)
   */
  private roundDecimal(num : number, precision:number): number{
    let tmp: number = Math.pow(10, precision);
    return Math.round( num*tmp )/tmp;
  }
}
