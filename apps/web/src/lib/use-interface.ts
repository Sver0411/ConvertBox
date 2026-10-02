'use client';
import {useEffect,useState} from 'react';
import type {Language} from './messages';
export function useInterface(){
 const [language,setLanguage]=useState<Language>('zh'),[theme,setTheme]=useState('light');
 useEffect(()=>{try{setLanguage(localStorage.getItem('convertbox-language')==='en'?'en':'zh');setTheme(localStorage.getItem('convertbox-theme')??'light')}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=language==='zh'?'zh-CN':'en';document.documentElement.dataset.theme=theme;},[language,theme]);
 return {language,theme,setLanguage:(value:Language)=>{setLanguage(value);try{localStorage.setItem('convertbox-language',value)}catch{}},setTheme:(value:string)=>{setTheme(value);try{localStorage.setItem('convertbox-theme',value)}catch{}}};
}
