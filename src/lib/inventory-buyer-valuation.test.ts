import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyerValuation } from '../../supabase/functions/_shared/inventory-valuation';
const types = [{id:'40',name:'35/40yd',category:'roro',data_hub_keywords:['40 Yard','35 Yard']}];
const rows = [{id:'40',name:'35/40yd',category:'roro',fleet:6,inYard:2,onSiteClews:4}];
const bands = [{asset_type:'roro',condition:'Fair',value:1800,size_group:'35/40',sizes:['40 CU YD']}];
test('fleet is site plus yard; verified value plus remaining Fair assumptions',()=>{
 const result=buyerValuation(rows,[{asset_type:'roro',size:'40 CU YD',condition:'Good',office_verified:true,value_override:3000},{asset_type:'roro',size:'40 CU YD',condition:'New',office_verified:false,value_override:4000}],bands,types);
 assert.equal(result.fleet,6);assert.equal(result.confirmedValue,3000);assert.equal(result.assumed,5);assert.equal(result.assumedValue,9000);
});
test('missing Fair rates stay unvalued rather than guessed',()=>{assert.equal(buyerValuation(rows,[],[],types).unvalued,6);});
test('excess verified profiles are flagged without negative assumptions',()=>{
 const p={asset_type:'roro',size:'40 CU YD',condition:'Fair',office_verified:true,value_override:null};
 const result=buyerValuation([{...rows[0],fleet:1}],[p,p],bands,types);assert.equal(result.surplus,1);assert.equal(result.assumed,0);
});