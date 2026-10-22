import {prepareCoverRequest} from './cover-binding.js';
if(typeof $request!=='undefined') {
  try{$done(prepareCoverRequest($request));}catch{$done({});}
}
