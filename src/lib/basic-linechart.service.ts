import { Injectable } from '@angular/core';
import { Data } from './basic-linechart.component';
import {str} from '../data';

export function parseBool(s: string):number {
  if(s=='ON') return 1;
  else if (s=='OFF') return 0;
  else return -1;
}

interface DATA<T>{
  timestamp: number;
  value: T;
  sensorId: string;
}

@Injectable({
  providedIn: 'root'
})

export class DataService {

  private str: string = str;

  public dataExample1: Data[] = []; 
  public dataExample2: Data[] = [];
  public dataExample3: Data[] = [];
  public dataExample4: Data[] = [];
  public dataExample5: Data[] = [];
  public dataExample6: Data[] = [];
  public dataExample7: Data[] = [];

  constructor() {
    this.generateExample();
  }

  private parse<T>(str: string, sensorId: string, f: (s: string) => T): DATA<T>[] {

    const L: DATA < T > [] = str.trim().split("\n").map(s => s.trim()).filter(s => s!=="")

                 .map( s => s.split(";").map( s => s.slice(1, -1) ) )

                 .filter( tab => tab[1] === sensorId )

                 .map( ([t, id, v]) => ({

                     timestamp: (new Date((t.replace(",", "."))).getTime()),

                     value: f(v),

                     sensorId: id

                 }));
    return L;

  }

  public generateData(label:string, color:string, style: "both"|"line"|"area",interpolation: "step"|"linear", f: (s:string)=>number):Data{
    let d: DATA<number>[] = this.parse<number>(this.str,label, f);
    let v: [number,number][] = [];
    d.forEach(element =>v.push([element.timestamp,element.value]));
    let da: Data = {
      label: label,
      values: v,
      color: color,
      style: style,
      interpolation: interpolation
    }
    return da;
  }

  private generateExample(){
    let d2: DATA<number>[] = this.parse<number>(this.str,"PC5", parseBool);
    let v2: [number,number][] = [];
    d2.forEach(element =>v2.push([element.timestamp,element.value]));
    let x:number = 0;
    v2.forEach(element=> {
      element[1]=x;
      x=this.getRandomInt(x);
    }
      );
    let da2: Data = {
      label: "PC5",
      values: v2,
      color: "purple",
      style: "line",
      interpolation: "linear"
    }
    
    this.dataExample2.push(this.generateData("PC6","#124568","both", "step",parseBool));
    this.dataExample1.push(da2);
    this.dataExample4.push(this.generateData("Presence_Salon", "pink", "line", "step", parseBool));
    this.dataExample3.push(this.generateData("Temperature_Salon", "purple", "line", "linear", parseFloat));
    this.dataExample3.push(this.generateData("PC6","#124568","both", "step",parseBool));
    this.dataExample5.push(this.generateData("Temperature_Cuisine", "gold", "line", "step", parseFloat));
    this.dataExample6.push(this.generateData("Presence_Cuisine", "purple", "both", "step", parseBool));
    this.dataExample7.push(this.generateData("Presence_SDB", "black", "area", "step", parseBool));
  }

  private getRandomInt(x:number){
    let alea: number;
    if(x==0){
      return 1;
    }else{
      alea=Math.round(Math.random());
      if(alea==0){
        return x-1;
      }else{
        return x+1;
      }
    }
  }
}
