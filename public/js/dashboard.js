'use strict';

$(document).ready(function () {

    $("#logout").on("click",function () {
      $.ajax({
        url: "/logout",
        type: "POST",
        success: function () {
            console.log("logged out!")
            window.location.replace("/");
        },
        error: function (jqXHR, textStatus, errorThrown) {
          $("body").text(jqXHR.statusText);
        }
      });

    });

  });