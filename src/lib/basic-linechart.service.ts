import { Injectable } from '@angular/core';
import { Data, parseBool } from './basic-linechart.component';
import {str} from '../data';

export interface DATA<T>{
  timestamp: number;
  value: T;
  sensorId: string;
}

@Injectable({
  providedIn: 'root'
})

export class DataService {

  str: string = str;

  public dataExample1: Data[] = []; 
  public dataExample2: Data[] = [];
  public dataExample3: Data[] = [];
  public dataExample4: Data[] = [];
  public dataExample5: Data[] = [];
  public dataExample6: Data[] = [];
  public dataExample7: Data[] = [];

  constructor() {
    this.generateData();
  }

  parse<T>(str: string, sensorId: string, f: (s: string) => T): DATA<T>[] {

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

  private generateData(){
    let d1: DATA<number>[] = this.parse<number>(this.str,"PC6", parseBool);
    let v1: [number,number][] = [];
    d1.forEach(element =>v1.push([element.timestamp,element.value]));
    let da1: Data = {
      label: "PC6",
      values: v1,
      color: "#124568",
      style: "both",
      interpolation: "step"
    }
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
    let d3: DATA<number>[] = this.parse<number>(this.str,"Presence_Salon", parseBool);
    let v3: [number,number][] = [];
    d3.forEach(element =>v3.push([element.timestamp,element.value]));
    let da3: Data = {
      label: "Presence_Salon",
      values: v3,
      color: "pink",
      style: "line",
      interpolation: "step"
    }

    let d4: DATA<number>[] = this.parse<number>(this.str,"Temperature_Salon",  parseFloat);
    let v4: [number,number][] = [];
    d4.forEach(element =>v4.push([element.timestamp,element.value]));
    let da4: Data = {
      label: "Temperature_Salon",
      values: v4,
      color: "purple",
      style: "line",
      interpolation: "linear"
    }

    let d5: DATA<number>[] = this.parse<number>(this.str,"Temperature_Cuisine",  parseFloat);
    let v5: [number,number][] = [];
    d5.forEach(element =>v5.push([element.timestamp,element.value]));
    let da5: Data = {
      label: "Temperature_Cuisine",
      values: v5,
      color: "gold",
      style: "line",
      interpolation: "step"
    }

    let d6: DATA<number>[] = this.parse<number>(this.str,"Presence_Cuisine",  parseBool);
    let v6: [number,number][] = [];
    d6.forEach(element =>v6.push([element.timestamp,element.value]));
    let da6: Data = {
      label: "Presence_Cuisine",
      values: v6,
      color: "purple",
      style: "both",
      interpolation: "step"
    }

    let d7: DATA<number>[] = this.parse<number>(this.str,"Presence_SDB",  parseBool);
    let v7: [number,number][] = [];
    d7.forEach(element =>v7.push([element.timestamp,element.value]));
    let da7: Data = {
      label: "Presence_SDB",
      values: v7,
      color: "black",
      style: "area",
      interpolation: "step"
    }
    
    
    this.dataExample2.push(da1);
    this.dataExample1.push(da2);
    this.dataExample4.push(da4);
    this.dataExample3.push(da3);
    this.dataExample3.push(da1);
    this.dataExample5.push(da5);
    this.dataExample6.push(da6);
    this.dataExample7.push(da7);
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
