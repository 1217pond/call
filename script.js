document.getElementById("login").addEventListener("click",() => {
  license = document.getElementById("pass_input").value;
  nameplate = document.getElementById("name_input").value;
  let _apikey = decrypt(encrypted_apikey,license.replace(/-/g,""));
  if(_apikey.substr(0,8) == "API-key_"){
    apikey = _apikey.substr(8);
    pop_up("ログインしました。");
    Cookies.set("license",license,{expires: 7});
    Cookies.set("nameplate",nameplate,{expires: 7});
    document.getElementById("login_form").remove();
    prep();
  }else{
    pop_up("ログインに失敗しました。",true);
  }
});

document.getElementById("leave").addEventListener("click",() => {
  Room.close();
  document.getElementById("dest_form").hidden = false;
  document.getElementById("preview").hidden = false;
  document.getElementById("chat_controller").hidden = true;
  document.getElementById("chat_area").hidden = true;
  document.getElementById("join").hidden = false;
  document.getElementById("leave").hidden = true;
  document.getElementById("call_area").innerHTML = "";
  document.getElementById("chat_area").innerHTML = "";
  document.getElementById("preview").srcObject = localStream;
  pop_up("退出しました。");
},true);

document.getElementById("send").addEventListener("click",() => {
  let send_el = document.getElementById("send_input");
  chat_push(`${nameplate}: ${send_el.value}`);
  Room.send({type:"send",text:send_el.value});
  send_el.value = "";
});

function prep(){
  document.getElementById("dest_form").removeAttribute("hidden");
  document.getElementById("call_controller").removeAttribute("hidden");
  // カメラ映像取得
  let peer;
  try {
    peer = new Peer({//peerサーバーに接続
      key: apikey,
      debug: 1
    });
  }catch(e){
    pop_up(`エラーが発生しました。<br>${e}`,true);
    console.log(e);
  }

  if(peer){
    peer.on("error",error => {
      pop_up(`エラーが発生しました。<br>${error}`,true);
      console.log(error);
    });

    peer.once("open",async(id) => {//peer idを取得
      peer_id = id;
      console.log(id);
      
      devices = await navigator.mediaDevices.enumerateDevices();
      for(device of devices){
        switch(device.kind){
          case "audioinput":
            var op = document.createElement("option");
            op.value = device.deviceId;
            op.textContent = device.label;
            document.getElementById("mic_slc").appendChild(op);
            break;
          case "videoinput":
            var op = document.createElement("option");
            op.value = device.deviceId;
            op.textContent = device.label;
            document.getElementById("cam_slc").appendChild(op);
            break;
        }
      }
      //画面共有
      if("getDisplayMedia" in navigator.mediaDevices){
        var op = document.createElement("option");
        op.value = "display";
        op.textContent = "画面共有";
        document.getElementById("cam_slc").appendChild(op);
      }
      localStream = await get_stream({
        cam:document.getElementById("cam_slc").value,
        mic:document.getElementById("mic_slc").value
      });

      document.getElementById("preview").srcObject = localStream;

      document.getElementById("cam").addEventListener("change",() => {
        document.getElementById("cam_slc").disabled = !document.getElementById("cam").checked;
        localStream.getVideoTracks()[0].enabled = document.getElementById("cam").checked;
      });
      document.getElementById("mic").addEventListener("change",() => {
        document.getElementById("mic_slc").disabled = !document.getElementById("mic").checked;
        localStream.getAudioTracks()[0].enabled = document.getElementById("mic").checked;
      });
      document.getElementById("cam_slc").addEventListener("change",async() => {
        localStream = await get_stream({
          cam:document.getElementById("cam_slc").value,
          mic:document.getElementById("mic_slc").value
        });

        localStream.getVideoTracks()[0].enabled = document.getElementById("cam").checked;
        localStream.getAudioTracks()[0].enabled = document.getElementById("mic").checked;

        if(document.getElementById("dest_form").hidden){
          document.getElementById(`video_${peer_id}`).srcObject = localStream;
          Room.replaceStream(localStream);
        }else{
          document.getElementById("preview").srcObject = localStream;
        }
        
      });
      document.getElementById("mic_slc").addEventListener("change",async() => {
        localStream = await get_stream({
          cam:document.getElementById("cam_slc").value,
          mic:document.getElementById("mic_slc").value
        });
        
        localStream.getVideoTracks()[0].enabled = document.getElementById("cam").checked;
        localStream.getAudioTracks()[0].enabled = document.getElementById("mic").checked;

        if(document.getElementById("dest_form").hidden){
          document.getElementById(`video_${peer_id}`).srcObject = localStream;
          Room.replaceStream(localStream);
        }else{
          document.getElementById("preview").srcObject = localStream;
        }
      });

      document.getElementById("join").addEventListener("click",() => {
        if(document.getElementById("room_input").value != ""){
          localStream.getVideoTracks()[0].enabled = document.getElementById("cam").checked;
          localStream.getAudioTracks()[0].enabled = document.getElementById("mic").checked;

          Room = peer.joinRoom(document.getElementById("room_input").value, {
            mode: "sfu",
            stream: localStream,
          });

          Room.on("open",() => {//通話に接続したとき
            chat_push(`===="${document.getElementById("room_input").value}"に参加しました。====`);

            let member_geted = false;
            let members = {};
            members[peer_id] = {name:nameplate,cam_state:document.getElementById("cam").checked,mic_state:document.getElementById("mic").checked};

            Room.send({type:"join",name:nameplate,cam_state:document.getElementById("cam").checked,mic_state:document.getElementById("mic").checked});
            
            document.getElementById("cam").addEventListener("change",() => {//カメラ状態変更
              members[peer_id].cam_state = document.getElementById("cam").checked;
              document.getElementById(`cam_state_${peer_id}`).src = members[peer_id].cam_state ? "cam_on.png":"cam_off.png";
              Room.send({type:"cam_state",state:document.getElementById("cam").checked});
            });
            document.getElementById("mic").addEventListener("change",() => {//マイク状態変更
              members[peer_id].mic_state = document.getElementById("mic").checked;
              document.getElementById(`mic_state_${peer_id}`).src = members[peer_id].mic_state ? "unmute.png":"mute.png";
              Room.send({type:"mic_state",state:document.getElementById("mic").checked});
            });

            let call_div = document.createElement("div");
            document.getElementById("call_area").appendChild(call_div);
            call_div.id = `call_${peer_id}`;
            call_div.innerHTML = `<font class="serif" id="name_label_${peer_id}">${nameplate}</font><img id="mic_state_${peer_id}" width="20"><img id="cam_state_${peer_id}" width="20"><br>`;
            document.getElementById(`cam_state_${peer_id}`).src = members[peer_id].cam_state ? "cam_on.png":"cam_off.png";
            document.getElementById(`mic_state_${peer_id}`).src = members[peer_id].mic_state ? "unmute.png":"mute.png";
            const ve = document.createElement("video");
            ve.srcObject = localStream;
            ve.width = 500;
            ve.muted = true;
            ve.playsInline = true;
            ve.id = `video_${peer_id}`;
            ve.autoplay = true;
            call_div.appendChild(ve);
            document.getElementById("dest_form").hidden = true;
            document.getElementById("chat_controller").hidden = false;
            document.getElementById("chat_area").hidden = false;
            document.getElementById("join").hidden = true;
            document.getElementById("leave").hidden = false;
            document.getElementById("preview").srcObject = null;

            Room.on("data",({src,data}) => {//データを受信したとき
              switch (data.type){
                case "join":
                  document.getElementById(`name_label_${src}`).textContent = data.name;
                  document.getElementById(`cam_state_${src}`).src = data.cam_state ? "cam_on.png":"cam_off.png";
                  document.getElementById(`mic_state_${src}`).src = data.mic_state ? "unmute.png":"mute.png";
                  members[src] = {name:data.name,mic_state:data.mic_state,cam_state:data.cam_state};
                  chat_push(`===="${data.name}"が参加しました。====`);
                  break;
                case "members":
                  if(!member_geted && data.dest_id == peer_id){
                    members = data.members;
                    for(let member_id of Object.keys(members)){
                      let call_div = document.createElement("div");
                      document.getElementById("call_area").appendChild(call_div);
                      call_div.id = `call_${member_id}`;
                      call_div.innerHTML = `<font class="serif" id="name_label_${member_id}">${members[member_id].name}</font><img id="mic_state_${member_id}" width="20"><img id="cam_state_${member_id}" width="20"><br>`;
                      document.getElementById(`cam_state_${member_id}`).src = members[member_id].cam_state ? "cam_on.png":"cam_off.png";
                      document.getElementById(`mic_state_${member_id}`).src = members[member_id].mic_state ? "unmute.png":"mute.png";
                    }
                    members[peer_id] = {name:nameplate,cam_state:document.getElementById("cam").checked,mic_state:document.getElementById("mic").checked};
                    member_geted = true;
                  }
                  break;
                case "mic_state":
                  members[src].mic_state = data.state;
                  document.getElementById(`mic_state_${src}`).src = data.state ? "unmute.png":"mute.png";
                  break;
                case "cam_state":
                  members[src].cam_state = data.state;
                  document.getElementById(`cam_state_${src}`).src = data.state ? "cam_on.png":"cam_off.png";
                  break;
                case "send":
                  chat_push(`${members[src].name} : ${data.text}`);
              }
            });

            Room.on("stream", (stream) => {//他人のmediastreamを取得
              const ve = document.createElement("video");
              ve.srcObject = stream;
              ve.playsInline = true;
              ve.id = `video_${stream.peerId}`;
              ve.width = 500;
              document.getElementById(`call_${stream.peerId}`).appendChild(ve);
              ve.play();
            });

            Room.on("peerJoin",(id) => {//参加してきたとき
              Room.send({type:"members",members:members,dest_id:id});
              let call_div = document.createElement("div");
              document.getElementById("call_area").appendChild(call_div);
              call_div.id = `call_${id}`;
              call_div.innerHTML = `<font class="serif" id="name_label_${id}">読み込み中...</font><img id="mic_state_${id}" src="loading.png" width="20"><img id="cam_state_${id}" src="loading.png" width="20"><br>`;
            });

            Room.on("peerLeave", (id) => {//退出したとき
              document.getElementById(`call_${id}`).remove();
              chat_push(`===="${members[id].name}"が退出しました。====`);
              delete members[id];
            }); 
            
            pop_up("接続しました。");
          });
        }else{
          pop_up("ルーム名を入力してください。",true);
        }
      });
    });
  }
}

async function get_stream(src_id){
  return new Promise((resolve, reject) => {
    if(src_id.cam == "display"){
      navigator.mediaDevices.getUserMedia({video:false,audio:{deviceId: src_id.mic}}).then(user_stream => {
        navigator.mediaDevices.getDisplayMedia({audio:false}).then(display_stream => {
          display_stream.addTrack(user_stream.getAudioTracks()[0]);
          resolve(display_stream);
        }).catch(error => {
          console.error(error);
        });
      }).catch(error => {
        console.error(error);
      });
    }else{
      navigator.mediaDevices.getUserMedia({video:{deviceId: src_id.cam},audio:{deviceId: src_id.mic}}).then(stream => {
        resolve(stream);
      }).catch(error => {
        console.error(error);
      });
    }
  });
}

document.getElementById("delete_cookie").addEventListener("click",() => {
  Cookies.remove("license");
  Cookies.remove("nameplate");
});

function pop_up(text,error=false){
  let pop_up_el = document.createElement("div");
  pop_up_el.innerHTML = text;
  if(error){
    pop_up_el.className = "pop-up_error";
  }else{
    pop_up_el.className = "pop-up";
  }
  popupArea.insertBefore(pop_up_el,popupArea.children[0]);
  window.setTimeout(() => {
    pop_up_el.remove();
  },3000);
}

function chat_push(text){
  document.getElementById("chat_area").innerHTML += `<font>${text}</font><br>`;
}

function encrypt(src,key){
  return CryptoJS.AES.encrypt(src, key).toString();
}
  
function decrypt(src, key){
  try{
    return CryptoJS.AES.decrypt(src, key).toString(CryptoJS.enc.Utf8);
  }catch(e){
    console.log(e);
    return "";
  }
}

let acc_pass;
let acc_name;
let main_pass;
let peer_id;
let encrypted_apikey = "U2FsdGVkX1/IzauGGFLmOeIrbsQCp4R8aO2zueDqCcgtfxgeZj1lFB4pepBAOViXtMU+yPLAdGpR8eq3FC2Tww=="; 
let apikey;
let popupArea = document.getElementById('pop-up');//ポップアップエリア
let localStream;
let mic_track;
let cam_track;
let Room;

if(~String(document.cookie).indexOf("nameplate")){
  document.getElementById("pass_input").value = Cookies.get('license'); 
  document.getElementById("name_input").value = Cookies.get('nameplate'); 
}